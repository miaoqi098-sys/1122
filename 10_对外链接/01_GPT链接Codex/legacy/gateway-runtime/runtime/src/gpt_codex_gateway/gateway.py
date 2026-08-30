from __future__ import annotations

import asyncio
import hashlib
import os
import re
import shutil
import uuid
from pathlib import Path

from .app_server import CodexAppServerClient
from .authority import AuthorityPolicy
from .config import GatewaySettings, ProjectConfig
from .ledger import TaskLedger
from .models import GatewayStatus, TaskRecord, TaskStatus


_SECRET_REF = re.compile(r"^[A-Z][A-Z0-9_]{2,127}$")


class GatewayService:
    def __init__(self, settings: GatewaySettings):
        self.settings = settings
        self.ledger = TaskLedger(settings.data_dir / "gateway.sqlite3")
        self.ledger.mark_inflight_unknown()
        self.authority = AuthorityPolicy()
        self._client: CodexAppServerClient | None = None
        self._client_lock = asyncio.Lock()
        self._monitors: set[asyncio.Task[None]] = set()

    def _project(self, project_id: str) -> ProjectConfig:
        project = self.settings.project(project_id)
        if not project.root.exists() or not project.root.is_dir():
            raise FileNotFoundError(f"Configured project root does not exist: {project.root}")
        return project

    async def _ensure_client(self) -> CodexAppServerClient:
        if self._client is not None and self._client.running:
            return self._client
        async with self._client_lock:
            if self._client is not None and self._client.running:
                return self._client
            bootstrap_root = self._project(self.settings.projects[0].id).root
            client = CodexAppServerClient(
                self.settings.codex_command,
                approval_policy=self.settings.approval_policy,
                sandbox=self.settings.sandbox,
                authority=self.authority,
            )
            await client.start(bootstrap_root)
            self._client = client
            return client

    async def status(self) -> GatewayStatus:
        binary = shutil.which(self.settings.codex_command[0])
        return GatewayStatus(
            gateway="ONLINE",
            codex_binary=binary,
            app_server_process=("RUNNING" if self._client is not None and self._client.running else "NOT_STARTED"),
            data_store=str(self.ledger.db_path),
            approval_policy=self.settings.approval_policy,
            sandbox=self.settings.sandbox,
        )

    def list_projects(self) -> list[dict[str, str]]:
        return [{"id": p.id, "root": str(p.root)} for p in self.settings.projects]

    async def start_task(
        self,
        *,
        project_id: str,
        conversation_id: str,
        instruction: str,
        title: str | None = None,
    ) -> TaskRecord:
        if not instruction.strip():
            raise ValueError("instruction must not be empty")
        project = self._project(project_id)
        client = await self._ensure_client()
        thread_id = self.ledger.get_thread(project_id, conversation_id)
        if thread_id:
            try:
                thread_id = await client.thread_resume(thread_id, project.root)
            except Exception:
                # A stale/missing persisted Codex thread is replaced deliberately;
                # the old id remains in task history and is never rewritten.
                thread_id = await client.thread_start(project.root)
        else:
            thread_id = await client.thread_start(project.root)
        self.ledger.put_thread(project_id, conversation_id, thread_id)
        turn_id = await client.turn_start(
            thread_id,
            project.root,
            instruction,
            title or f"GPT task {conversation_id[:24]}",
        )
        task = TaskRecord(
            task_id=f"codex-{uuid.uuid4().hex}",
            project_id=project_id,
            conversation_id=conversation_id,
            thread_id=thread_id,
            turn_id=turn_id,
            status=TaskStatus.RUNNING,
            prompt_hash=hashlib.sha256(instruction.encode("utf-8")).hexdigest(),
        )
        self.ledger.create_task(task)
        monitor = asyncio.create_task(self._monitor_task(task), name=f"monitor-{task.task_id}")
        self._monitors.add(monitor)
        monitor.add_done_callback(self._monitors.discard)
        return task

    async def _monitor_task(self, task: TaskRecord) -> None:
        try:
            client = await self._ensure_client()
            completion = await client.wait_for_turn(
                task.thread_id,
                task.turn_id,
                timeout=self.settings.turn_timeout_seconds,
            )
            status_map = {
                "completed": TaskStatus.COMPLETED,
                "interrupted": TaskStatus.INTERRUPTED,
                "failed": TaskStatus.FAILED,
            }
            final_status = status_map.get(completion.status, TaskStatus.UNKNOWN)
            error = None
            if final_status == TaskStatus.FAILED:
                error = str((completion.raw.get("params") or {}).get("turn", {}).get("error") or "Codex turn failed")
            self.ledger.update_task(
                task.task_id,
                status=final_status,
                result=completion.result_text[:100_000],
                error=error,
            )
        except TimeoutError:
            self.ledger.update_task(task.task_id, status=TaskStatus.UNKNOWN, error="Turn monitor timed out")
        except Exception as exc:
            self.ledger.update_task(task.task_id, status=TaskStatus.UNKNOWN, error=f"Monitor error: {type(exc).__name__}")

    async def continue_task(self, task_id: str, instruction: str) -> TaskRecord:
        previous = self.ledger.get_task(task_id)
        if previous is None:
            raise KeyError(task_id)
        return await self.start_task(
            project_id=previous.project_id,
            conversation_id=previous.conversation_id,
            instruction=instruction,
            title=f"Continue {task_id}",
        )

    def get_task(self, task_id: str) -> TaskRecord:
        record = self.ledger.get_task(task_id)
        if record is None:
            raise KeyError(task_id)
        return record

    async def cancel_task(self, task_id: str) -> TaskRecord:
        record = self.get_task(task_id)
        if record.status not in {TaskStatus.STARTING, TaskStatus.RUNNING, TaskStatus.CANCEL_REQUESTED}:
            return record
        client = await self._ensure_client()
        await client.turn_interrupt(record.thread_id, record.turn_id)
        return self.ledger.update_task(task_id, status=TaskStatus.CANCEL_REQUESTED)

    async def run_command(
        self, *, project_id: str, conversation_id: str, command: str, purpose: str = ""
    ) -> TaskRecord:
        instruction = (
            "Execute the following command inside the authorized project root. Verify the result and fix only issues "
            "necessary to complete the stated purpose. Do not print secrets.\n\n"
            f"PURPOSE: {purpose or 'Run and verify the requested command.'}\nCOMMAND:\n{command}"
        )
        return await self.start_task(
            project_id=project_id,
            conversation_id=conversation_id,
            instruction=instruction,
            title="Run authorized command",
        )

    async def apply_changes(
        self, *, project_id: str, conversation_id: str, instruction: str
    ) -> TaskRecord:
        wrapped = (
            "Apply the requested engineering changes directly in the authorized project. Run relevant tests/validation. "
            "Do not only describe the changes; perform them. Do not reveal secrets.\n\nREQUEST:\n"
            + instruction
        )
        return await self.start_task(
            project_id=project_id,
            conversation_id=conversation_id,
            instruction=wrapped,
            title="Apply project changes",
        )

    async def use_secret(
        self,
        *,
        project_id: str,
        conversation_id: str,
        secret_ref: str,
        instruction: str,
    ) -> TaskRecord:
        if not _SECRET_REF.fullmatch(secret_ref):
            raise ValueError("secret_ref must be an uppercase environment variable name")
        if secret_ref not in os.environ:
            raise KeyError(f"Secret reference is not available in the Gateway environment: {secret_ref}")
        wrapped = (
            f"A protected environment variable named {secret_ref} is available to the local process. Use it only as "
            "required for the task. Never print, echo, log, persist, commit, or return its plaintext value.\n\nTASK:\n"
            + instruction
        )
        return await self.start_task(
            project_id=project_id,
            conversation_id=conversation_id,
            instruction=wrapped,
            title=f"Use protected secret reference {secret_ref}",
        )

    async def close(self) -> None:
        for monitor in list(self._monitors):
            monitor.cancel()
        if self._client is not None:
            await self._client.close()
            self._client = None
