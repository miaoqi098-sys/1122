from __future__ import annotations

import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = "miaoqi098-sys/-"
BRANCH = "codex-dispatch"
INBOX = ".codex-bridge/inbox/current.json"
RESULT_DIR = ".codex-bridge/results"
GATEWAY = "http://127.0.0.1:8765/mcp/"
GATEWAY_HEALTH = "http://127.0.0.1:8765/health"
GATEWAY_TASK_NAME = "AmazonAgent-GPT-Codex-Gateway"
PROTOCOL = "2025-06-18"
POLL_SECONDS = 30
GH_TIMEOUT_SECONDS = 45
MAX_CODEX_SECONDS = 180
STATE_FILE = Path(os.environ.get("LOCALAPPDATA", ".")) / "AmazonAgent" / "GPTCodexGateway" / "bridge-state.json"
ALLOWED_DOMAIN = "sorilo-uk.com"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(message: str) -> None:
    print(f"[{now_iso()}] {message}", flush=True)


def gh_api(args: list[str], stdin_text: str | None = None) -> Any:
    try:
        proc = subprocess.run(
            ["gh", "api", *args],
            input=stdin_text,
            text=True,
            capture_output=True,
            check=False,
            timeout=GH_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"GitHub CLI request timed out after {GH_TIMEOUT_SECONDS}s") from exc
    if proc.returncode != 0:
        raise RuntimeError(f"GitHub CLI request failed: {proc.stderr.strip()[:500]}")
    text = proc.stdout.strip()
    return json.loads(text) if text else None


def read_repo_json(path: str) -> tuple[dict[str, Any] | None, str | None]:
    endpoint = f"repos/{REPO}/contents/{path}"
    try:
        value = gh_api([endpoint, "--method", "GET", "-f", f"ref={BRANCH}"])
    except RuntimeError as exc:
        if "404" in str(exc):
            return None, None
        raise
    content = base64.b64decode(value["content"]).decode("utf-8")
    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise ValueError("Repository JSON payload must be an object")
    return parsed, str(value["sha"])


def write_repo_json(path: str, value: dict[str, Any], message: str) -> None:
    _, sha = read_repo_json(path)
    encoded_content = base64.b64encode(
        (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    ).decode("ascii")
    endpoint = f"repos/{REPO}/contents/{path}"
    args = [endpoint, "--method", "PUT", "-f", f"message={message}", "-f", f"content={encoded_content}", "-f", f"branch={BRANCH}"]
    if sha:
        args += ["-f", f"sha={sha}"]
    gh_api(args)


def load_state() -> dict[str, Any]:
    if not STATE_FILE.exists():
        return {"last_task_id": None}
    try:
        value = json.loads(STATE_FILE.read_text(encoding="utf-8-sig"))
        return value if isinstance(value, dict) else {"last_task_id": None}
    except Exception:
        return {"last_task_id": None}


def save_state(task_id: str) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"last_task_id": task_id}, indent=2), encoding="utf-8")


def validate_task(task: dict[str, Any]) -> tuple[str, str]:
    task_id = str(task.get("task_id", "")).strip()
    task_type = str(task.get("task_type", "")).strip()
    if not task_id or task_type != "website_online":
        raise ValueError("Only task_type=website_online is allowed")
    forbidden = {"command", "shell", "powershell", "token", "secret", "password", "credential"}
    if forbidden.intersection({str(k).lower() for k in task.keys()}):
        raise ValueError("Task contains a forbidden field")
    params = task.get("parameters") or {}
    if not isinstance(params, dict) or set(params) - {"domain"}:
        raise ValueError("Only the domain parameter is allowed")
    domain = str(params.get("domain") or ALLOWED_DOMAIN).strip().lower()
    if domain != ALLOWED_DOMAIN:
        raise ValueError(f"Domain must be {ALLOWED_DOMAIN}")
    return task_id, domain


def gateway_online() -> bool:
    try:
        with urllib.request.urlopen(GATEWAY_HEALTH, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return str(payload.get("gateway", "")).upper() == "ONLINE"
    except Exception:
        return False


def ensure_gateway_online() -> None:
    if gateway_online():
        return
    log("GATEWAY_OFFLINE attempting scheduled-task recovery")
    proc = subprocess.run(["schtasks", "/Run", "/TN", GATEWAY_TASK_NAME], text=True, capture_output=True, check=False, timeout=20)
    if proc.returncode != 0:
        raise RuntimeError(f"Unable to start Gateway scheduled task: {proc.stderr.strip()[:500]}")
    deadline = time.time() + 45
    while time.time() < deadline:
        if gateway_online():
            log("GATEWAY_RECOVERED ONLINE")
            return
        time.sleep(2)
    raise RuntimeError("Gateway did not become ONLINE within 45 seconds")


def mcp_call(name: str, arguments: dict[str, Any], request_id: int) -> dict[str, Any]:
    ensure_gateway_online()
    payload = {"jsonrpc": "2.0", "id": request_id, "method": "tools/call", "params": {"name": name, "arguments": arguments}}
    request = urllib.request.Request(GATEWAY, data=json.dumps(payload).encode("utf-8"), method="POST")
    request.add_header("Content-Type", "application/json")
    request.add_header("Accept", "application/json, text/event-stream")
    request.add_header("MCP-Protocol-Version", PROTOCOL)
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = json.loads(response.read().decode("utf-8"))
    if "error" in raw:
        raise RuntimeError(f"Gateway MCP error: {raw['error']}")
    return raw


def extract_tool_payload(response: dict[str, Any]) -> dict[str, Any]:
    result = response.get("result") or {}
    structured = result.get("structuredContent")
    if isinstance(structured, dict):
        return structured
    for item in result.get("content") or []:
        if isinstance(item, dict) and isinstance(item.get("text"), str):
            try:
                parsed = json.loads(item["text"])
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
    raise RuntimeError("Unable to decode Gateway tool response")


def website_instruction(domain: str) -> str:
    return f"""Perform ONLY the deployment/infrastructure work required to make https://{domain} publicly reachable using the existing website source under C:\\AmazonAgent. Do not redesign or rewrite business content. You may use Cloudflare/Wrangler only if a valid non-interactive local authorization already exists. CRITICAL: never launch, wait for, or depend on an interactive browser login, OAuth prompt, device-code flow, or terminal prompt. If Cloudflare is not already authorized non-interactively, stop immediately and return status AUTH_REQUIRED with the exact local authorization capability that is missing; do not keep running. Never print or return credentials. Do not alter unrelated DNS records, registrar ownership, zone ownership, or account security. If authorized, deploy the existing static site, bind {domain}, correct only required DNS, enable/verify HTTPS, and verify the homepage. Return deployment status, DNS changes, custom-domain status, HTTPS status, homepage HTTP status, and blockers."""


def run_task(task: dict[str, Any]) -> dict[str, Any]:
    task_id, domain = validate_task(task)
    log(f"TASK_FOUND task_id={task_id} type=website_online domain={domain}")
    log("CODEX_START sending task to local Gateway")
    start = extract_tool_payload(mcp_call("codex_start_task", {"project_id": "amazon-agent", "conversation_id": "github-bridge-website-online", "instruction": website_instruction(domain), "title": f"Bring {domain} online"}, 101))
    local_task_id = str(start.get("task_id", ""))
    if not local_task_id:
        raise RuntimeError("Gateway did not return task_id")
    log(f"CODEX_STARTED local_task_id={local_task_id}")

    deadline = time.time() + MAX_CODEX_SECONDS
    latest: dict[str, Any] = {}
    last_status = None
    while time.time() < deadline:
        time.sleep(10)
        latest = extract_tool_payload(mcp_call("codex_read_result", {"task_id": local_task_id}, 102))
        status = str(latest.get("status", "")).upper()
        if status != last_status:
            log(f"CODEX_STATUS {status or 'UNKNOWN'}")
            last_status = status
        if status not in {"RUNNING", "PENDING", "QUEUED"}:
            summary = latest.get("result") or latest.get("error") or "No result text returned"
            log(f"CODEX_FINISHED status={status or 'UNKNOWN'}")
            return {"task_id": task_id, "task_type": "website_online", "status": status or "UNKNOWN", "completed_at": now_iso(), "summary": str(summary)[:12000], "local_codex_task_id": local_task_id}

    log(f"CODEX_TIMEOUT after={MAX_CODEX_SECONDS}s cancelling local_task_id={local_task_id}")
    try:
        mcp_call("codex_cancel_task", {"task_id": local_task_id}, 103)
        cancel_note = "Codex task was cancelled automatically."
    except Exception as exc:
        cancel_note = f"Cancellation request failed: {type(exc).__name__}: {exc}"
    return {"task_id": task_id, "task_type": "website_online", "status": "TIMEOUT", "completed_at": now_iso(), "summary": f"Codex remained non-terminal for more than {MAX_CODEX_SECONDS} seconds. {cancel_note}", "local_codex_task_id": local_task_id}


def process_once() -> bool:
    log("POLL checking GitHub inbox")
    task, _ = read_repo_json(INBOX)
    if not task:
        log("POLL no inbox task found")
        return False
    task_id = str(task.get("task_id", "")).strip()
    task_type = str(task.get("task_type", "")).strip()
    if not task_id:
        return False
    if task_type == "none":
        save_state(task_id)
        return False
    if load_state().get("last_task_id") == task_id:
        log(f"POLL task already processed task_id={task_id}")
        return False
    try:
        result = run_task(task)
    except Exception as exc:
        log(f"TASK_FAILED {type(exc).__name__}: {exc}")
        result = {"task_id": task_id, "task_type": str(task.get("task_type", "unknown")), "status": "FAILED", "completed_at": now_iso(), "summary": f"Bridge failure: {type(exc).__name__}: {exc}"}
    safe_name = "".join(c for c in task_id if c.isalnum() or c in "-_")[:80] or "invalid-task"
    log(f"WRITE_BACK {RESULT_DIR}/{safe_name}.json")
    write_repo_json(f"{RESULT_DIR}/{safe_name}.json", result, f"codex bridge: result {safe_name}")
    save_state(task_id)
    log(f"TASK_DONE task_id={task_id}")
    return True


def main() -> None:
    print("AmazonAgent controlled Codex task bridge ONLINE", flush=True)
    print(f"Repository: {REPO} | branch: {BRANCH} | task: website_online | max_runtime={MAX_CODEX_SECONDS}s", flush=True)
    while True:
        try:
            process_once()
        except Exception as exc:
            log(f"BRIDGE_LOOP_ERROR {type(exc).__name__}: {exc}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
