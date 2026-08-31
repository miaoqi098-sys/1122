from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .authority import AuthorityPolicy


class AppServerProtocolError(RuntimeError):
    pass


def parse_json_line(line: bytes | str) -> dict[str, Any]:
    text = line.decode("utf-8") if isinstance(line, bytes) else line
    value = json.loads(text)
    if not isinstance(value, dict):
        raise AppServerProtocolError("app-server message must be a JSON object")
    return value


def extract_thread_id(response: dict[str, Any]) -> str:
    try:
        return str(response["result"]["thread"]["id"])
    except (KeyError, TypeError) as exc:
        raise AppServerProtocolError("thread id missing from app-server response") from exc


def extract_turn_id(response: dict[str, Any]) -> str:
    try:
        return str(response["result"]["turn"]["id"])
    except (KeyError, TypeError) as exc:
        raise AppServerProtocolError("turn id missing from app-server response") from exc


def build_thread_start_params(cwd: Path, approval_policy: str, sandbox: str) -> dict[str, Any]:
    return {
        "cwd": str(cwd),
        "approvalPolicy": approval_policy,
        "sandbox": sandbox,
    }


def build_turn_start_params(
    thread_id: str,
    cwd: Path,
    instruction: str,
    title: str,
    approval_policy: str,
) -> dict[str, Any]:
    return {
        "threadId": thread_id,
        "input": [{"type": "text", "text": instruction}],
        "cwd": str(cwd),
        "title": title,
        "approvalPolicy": approval_policy,
    }


@dataclass(slots=True)
class TurnCompletion:
    status: str
    result_text: str
    raw: dict[str, Any]


class CodexAppServerClient:
    def __init__(
        self,
        command: list[str],
        *,
        approval_policy: str,
        sandbox: str,
        authority: AuthorityPolicy | None = None,
    ):
        self.command = list(command)
        self.approval_policy = approval_policy
        self.sandbox = sandbox
        self.authority = authority or AuthorityPolicy()
        self._process: asyncio.subprocess.Process | None = None
        self._reader_task: asyncio.Task[None] | None = None
        self._stderr_task: asyncio.Task[None] | None = None
        self._pending: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._request_id = 0
        self._write_lock = asyncio.Lock()
        self._turn_waiters: dict[tuple[str, str], asyncio.Future[TurnCompletion]] = {}
        self._turn_completed: dict[tuple[str, str], TurnCompletion] = {}
        self._agent_text: dict[tuple[str, str], list[str]] = {}
        self._stderr_tail: list[str] = []

    @property
    def running(self) -> bool:
        return self._process is not None and self._process.returncode is None

    @property
    def stderr_tail(self) -> str:
        return "\n".join(self._stderr_tail[-20:])

    async def start(self, cwd: Path) -> None:
        if self.running:
            return
        self._process = await asyncio.create_subprocess_exec(
            *self.command,
            cwd=str(cwd),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=os.environ.copy(),
        )
        self._reader_task = asyncio.create_task(self._read_stdout(), name="codex-app-server-stdout")
        self._stderr_task = asyncio.create_task(self._read_stderr(), name="codex-app-server-stderr")
        await self.request(
            "initialize",
            {
                "clientInfo": {
                    "name": "amazon_agent_gpt_codex_gateway",
                    "title": "Amazon Agent GPT-Codex Gateway",
                    "version": "0.1.0",
                },
                "capabilities": {},
            },
            timeout=30,
        )
        await self.notify("initialized", {})

    async def request(self, method: str, params: dict[str, Any], *, timeout: float = 30) -> dict[str, Any]:
        if not self.running or self._process is None:
            raise RuntimeError("Codex App Server is not running")
        loop = asyncio.get_running_loop()
        self._request_id += 1
        request_id = self._request_id
        future: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending[request_id] = future
        await self._send({"id": request_id, "method": method, "params": params})
        try:
            response = await asyncio.wait_for(future, timeout=timeout)
        finally:
            self._pending.pop(request_id, None)
        if "error" in response:
            raise AppServerProtocolError(f"{method} failed: {response['error']}")
        return response

    async def notify(self, method: str, params: dict[str, Any]) -> None:
        await self._send({"method": method, "params": params})

    async def _send(self, payload: dict[str, Any]) -> None:
        if self._process is None or self._process.stdin is None:
            raise RuntimeError("Codex App Server stdin is unavailable")
        data = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
        async with self._write_lock:
            self._process.stdin.write(data)
            await self._process.stdin.drain()

    async def _read_stdout(self) -> None:
        assert self._process is not None and self._process.stdout is not None
        try:
            while True:
                line = await self._process.stdout.readline()
                if not line:
                    break
                try:
                    message = parse_json_line(line)
                    await self._dispatch(message)
                except Exception:
                    # Protocol noise must not crash the reader. A request waiting for a
                    # response will still time out and surface a deterministic failure.
                    continue
        finally:
            error = RuntimeError("Codex App Server stdout closed")
            for future in list(self._pending.values()):
                if not future.done():
                    future.set_exception(error)
            for future in list(self._turn_waiters.values()):
                if not future.done():
                    future.set_exception(error)

    async def _read_stderr(self) -> None:
        assert self._process is not None and self._process.stderr is not None
        while True:
            line = await self._process.stderr.readline()
            if not line:
                return
            text = line.decode("utf-8", errors="replace").rstrip()
            # Never forward stderr to a GPT tool result. Keep only a bounded local tail.
            self._stderr_tail.append(text)
            if len(self._stderr_tail) > 100:
                del self._stderr_tail[:-100]

    async def _dispatch(self, message: dict[str, Any]) -> None:
        if "id" in message and "method" not in message:
            future = self._pending.get(int(message["id"]))
            if future is not None and not future.done():
                future.set_result(message)
            return

        method = str(message.get("method", ""))
        params = message.get("params") or {}

        if "id" in message and method:
            await self._handle_server_request(message)
            return

        if method == "item/agentMessage/delta":
            key = (str(params.get("threadId", "")), str(params.get("turnId", "")))
            delta = params.get("delta")
            if key[0] and key[1] and isinstance(delta, str):
                self._agent_text.setdefault(key, []).append(delta)
            return

        if method == "turn/completed":
            turn = params.get("turn") or {}
            thread_id = str(params.get("threadId") or turn.get("threadId") or "")
            turn_id = str(turn.get("id") or params.get("turnId") or "")
            key = (thread_id, turn_id)
            completion = TurnCompletion(
                status=str(turn.get("status") or "completed"),
                result_text="".join(self._agent_text.pop(key, [])),
                raw=message,
            )
            waiter = self._turn_waiters.pop(key, None)
            if waiter is not None and not waiter.done():
                waiter.set_result(completion)
            else:
                self._turn_completed[key] = completion

    async def _handle_server_request(self, message: dict[str, Any]) -> None:
        request_id = message["id"]
        method = str(message.get("method", ""))
        params = message.get("params") or {}
        if "Approval" in method or "requestApproval" in method or method == "mcpServer/elicitation/request":
            result = self.authority.approval_response(method, params)
            await self._send({"id": request_id, "result": result})
            return
        await self._send(
            {
                "id": request_id,
                "error": {"code": -32601, "message": f"Unsupported server request: {method}"},
            }
        )

    async def thread_start(self, cwd: Path) -> str:
        response = await self.request(
            "thread/start",
            build_thread_start_params(cwd, self.approval_policy, self.sandbox),
        )
        return extract_thread_id(response)

    async def thread_resume(self, thread_id: str, cwd: Path) -> str:
        response = await self.request(
            "thread/resume",
            {
                "threadId": thread_id,
                "cwd": str(cwd),
                "approvalPolicy": self.approval_policy,
                "sandbox": self.sandbox,
            },
        )
        return extract_thread_id(response)

    async def turn_start(self, thread_id: str, cwd: Path, instruction: str, title: str) -> str:
        response = await self.request(
            "turn/start",
            build_turn_start_params(thread_id, cwd, instruction, title, self.approval_policy),
        )
        return extract_turn_id(response)

    async def turn_interrupt(self, thread_id: str, turn_id: str) -> None:
        await self.request("turn/interrupt", {"threadId": thread_id, "turnId": turn_id})

    async def wait_for_turn(self, thread_id: str, turn_id: str, timeout: int) -> TurnCompletion:
        key = (thread_id, turn_id)
        cached = self._turn_completed.pop(key, None)
        if cached is not None:
            return cached
        loop = asyncio.get_running_loop()
        future = self._turn_waiters.get(key)
        if future is None:
            future = loop.create_future()
            self._turn_waiters[key] = future
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        finally:
            self._turn_waiters.pop(key, None)

    async def close(self) -> None:
        process = self._process
        self._process = None
        if process is not None and process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except TimeoutError:
                process.kill()
                await process.wait()
        for task in (self._reader_task, self._stderr_task):
            if task is not None:
                task.cancel()
        self._reader_task = None
        self._stderr_task = None
