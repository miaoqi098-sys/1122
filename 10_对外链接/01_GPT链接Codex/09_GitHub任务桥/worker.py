from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO = "miaoqi098-sys/-"
BRANCH = "codex-dispatch"
INBOX = "10_对外链接/01_GPT链接Codex/09_GitHub任务桥/inbox/current.json"
RESULT_DIR = "10_对外链接/01_GPT链接Codex/09_GitHub任务桥/results"
GATEWAY = "http://127.0.0.1:8765/mcp/"
PROTOCOL = "2025-06-18"
POLL_SECONDS = 30
STATE_FILE = Path(os.environ.get("LOCALAPPDATA", ".")) / "AmazonAgent" / "GPTCodexGateway" / "bridge-state.json"
TOKEN_ENV = "AMAZON_AGENT_BRIDGE_GITHUB_TOKEN"
ALLOWED_DOMAIN = "sorilo-uk.com"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def token() -> str:
    value = os.environ.get(TOKEN_ENV, "").strip()
    if not value:
        raise RuntimeError(f"Missing environment variable {TOKEN_ENV}")
    return value


def gh_request(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    url = f"https://api.github.com/repos/{REPO}/{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("Authorization", f"Bearer {token()}")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
    return json.loads(raw.decode("utf-8")) if raw else None


def read_repo_json(path: str) -> tuple[dict[str, Any] | None, str | None]:
    encoded = urllib.parse.quote(path, safe="/")
    try:
        value = gh_request("GET", f"contents/{encoded}?ref={urllib.parse.quote(BRANCH)}")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None, None
        raise
    content = base64.b64decode(value["content"]).decode("utf-8")
    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise ValueError("Repository JSON payload must be an object")
    return parsed, str(value["sha"])


def write_repo_json(path: str, value: dict[str, Any], message: str) -> None:
    current, sha = read_repo_json(path)
    del current
    encoded_content = base64.b64encode(
        (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    ).decode("ascii")
    payload: dict[str, Any] = {
        "message": message,
        "content": encoded_content,
        "branch": BRANCH,
    }
    if sha:
        payload["sha"] = sha
    encoded = urllib.parse.quote(path, safe="/")
    gh_request("PUT", f"contents/{encoded}", payload)


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
    if not isinstance(params, dict):
        raise ValueError("parameters must be an object")
    if set(params) - {"domain"}:
        raise ValueError("Only the domain parameter is allowed")
    domain = str(params.get("domain") or ALLOWED_DOMAIN).strip().lower()
    if domain != ALLOWED_DOMAIN:
        raise ValueError(f"Domain must be {ALLOWED_DOMAIN}")
    return task_id, domain


def mcp_call(name: str, arguments: dict[str, Any], request_id: int) -> dict[str, Any]:
    payload = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    request = urllib.request.Request(
        GATEWAY,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
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
    content = result.get("content") or []
    for item in content:
        if isinstance(item, dict) and isinstance(item.get("text"), str):
            text = item["text"]
            try:
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                continue
    raise RuntimeError("Unable to decode Gateway tool response")


def website_instruction(domain: str) -> str:
    return f"""You are the local execution hand for the Amazon Agent project. Perform ONLY the deployment/infrastructure work needed to make https://{domain} publicly reachable. Do not redesign or rewrite website business content. Work from C:\\AmazonAgent and use the existing website source under the API qualification website project. Inspect the current Git state and deployment state first. Then, using only already-authorized local Cloudflare credentials or locally configured tooling, deploy the existing static site to Cloudflare Pages (or repair the existing Pages deployment), attach the custom domain {domain}, create or correct the necessary DNS records, ensure HTTPS/TLS becomes active, and verify the public homepage responds successfully over HTTPS. Never print, copy, commit, or return any token, password, API secret, refresh token, or credential. Do not alter unrelated DNS records. Do not transfer the domain, change registrar ownership, delete the zone, or disable account security. Return a concise report containing: deployment project/status, DNS records changed (record type/name/target only), custom-domain status, HTTPS status, homepage HTTP status, and any remaining blocker."""


def run_task(task: dict[str, Any]) -> dict[str, Any]:
    task_id, domain = validate_task(task)
    start = extract_tool_payload(
        mcp_call(
            "codex_start_task",
            {
                "project_id": "amazon-agent",
                "conversation_id": "github-bridge-website-online",
                "instruction": website_instruction(domain),
                "title": f"Bring {domain} online",
            },
            101,
        )
    )
    local_task_id = str(start.get("task_id", ""))
    if not local_task_id:
        raise RuntimeError("Gateway did not return task_id")

    deadline = time.time() + 1800
    latest: dict[str, Any] = {}
    while time.time() < deadline:
        time.sleep(10)
        latest = extract_tool_payload(
            mcp_call("codex_read_result", {"task_id": local_task_id}, 102)
        )
        status = str(latest.get("status", "")).upper()
        if status not in {"RUNNING", "PENDING", "QUEUED"}:
            break

    status = str(latest.get("status", "UNKNOWN"))
    summary = latest.get("result") or latest.get("error") or "No result text returned"
    return {
        "task_id": task_id,
        "task_type": "website_online",
        "status": status,
        "completed_at": now_iso(),
        "summary": str(summary)[:12000],
        "local_codex_task_id": local_task_id,
    }


def process_once() -> bool:
    task, _ = read_repo_json(INBOX)
    if not task:
        return False
    task_id = str(task.get("task_id", "")).strip()
    task_type = str(task.get("task_type", "")).strip()
    if not task_id:
        return False
    if task_type == "none":
        save_state(task_id)
        return False
    if load_state().get("last_task_id") == task_id:
        return False

    try:
        result = run_task(task)
    except Exception as exc:
        result = {
            "task_id": task_id,
            "task_type": str(task.get("task_type", "unknown")),
            "status": "FAILED",
            "completed_at": now_iso(),
            "summary": f"Bridge failure: {type(exc).__name__}: {exc}",
        }

    safe_name = "".join(c for c in task_id if c.isalnum() or c in "-_")[:80]
    if not safe_name:
        safe_name = "invalid-task"
    write_repo_json(
        f"{RESULT_DIR}/{safe_name}.json",
        result,
        f"codex bridge: result {safe_name}",
    )
    save_state(task_id)
    return True


def main() -> None:
    print("AmazonAgent controlled Codex task bridge ONLINE")
    print(f"Repository: {REPO} | branch: {BRANCH} | task: website_online")
    while True:
        try:
            process_once()
        except Exception as exc:
            print(f"bridge loop error: {type(exc).__name__}: {exc}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
