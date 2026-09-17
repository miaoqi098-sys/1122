from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPOSITORY = "miaoqi098-sys/1122"
BASE_BRANCH = "main"
TASK_TYPE = "engineering_task"
SPEC_PREFIX = ".codex-cloud/tasks/"
OPENAI_BASE = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
DEFAULT_MODEL = os.environ.get("OPENAI_AGENT_MODEL", "gpt-5.4")
POLL_SECONDS = int(os.environ.get("CODEX_POLL_SECONDS", "15"))
MAX_WAIT_SECONDS = int(os.environ.get("CODEX_MAX_WAIT_SECONDS", "3300"))


class DispatchError(RuntimeError):
    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_task(task: dict[str, Any]) -> dict[str, str]:
    required = {
        "task_id",
        "task_type",
        "created_at",
        "repository",
        "base_branch",
        "work_branch",
        "spec_path",
        "title",
    }
    if set(task) != required:
        missing = sorted(required - set(task))
        extra = sorted(set(task) - required)
        raise DispatchError(f"task fields mismatch missing={missing} extra={extra}")

    clean = {key: str(task[key]).strip() for key in required}
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{5,79}", clean["task_id"]):
        raise DispatchError("invalid task_id")
    if clean["task_type"] != TASK_TYPE:
        raise DispatchError(f"task_type must be {TASK_TYPE}")
    if clean["repository"] != REPOSITORY:
        raise DispatchError(f"repository must be {REPOSITORY}")
    if clean["base_branch"] != BASE_BRANCH:
        raise DispatchError(f"base_branch must be {BASE_BRANCH}")
    if not re.fullmatch(r"codex/[A-Za-z0-9._/-]+", clean["work_branch"]):
        raise DispatchError("work_branch must start with codex/")
    spec_path = clean["spec_path"]
    if not spec_path.startswith(SPEC_PREFIX) or not spec_path.endswith((".md", ".txt")):
        raise DispatchError(f"spec_path must be under {SPEC_PREFIX}")
    if ".." in Path(spec_path).parts:
        raise DispatchError("spec_path traversal is forbidden")
    if len(clean["title"]) < 3 or len(clean["title"]) > 160:
        raise DispatchError("invalid title")
    return clean


def read_spec(task: dict[str, str], checkout_root: Path) -> str:
    path = (checkout_root / task["spec_path"]).resolve()
    root = checkout_root.resolve()
    if root not in path.parents:
        raise DispatchError("spec_path escaped checkout root")
    if not path.is_file():
        raise DispatchError(f"spec file not found: {task['spec_path']}")
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise DispatchError("spec file is empty")
    if len(text) > 120_000:
        raise DispatchError("spec file is too large")
    return text


def build_session_payload(task: dict[str, str], spec: str, github_token: str, model: str) -> dict[str, Any]:
    if not github_token:
        raise DispatchError("GITHUB_TOKEN is missing")

    setup = " && ".join(
        [
            f"git clone https://github.com/{REPOSITORY}.git /workspace/1122",
            "git -C /workspace/1122 checkout main",
            "git -C /workspace/1122 config user.name '1122 Codex Cloud'",
            "git -C /workspace/1122 config user.email 'codex-cloud@users.noreply.github.com'",
            "git config --global credential.helper '!f() { echo username=x-access-token; echo \"password=$GH_TOKEN\"; }; f'",
        ]
    )

    instructions = """You are the engineering executor for the 1122 repository. Work only inside /workspace/1122. Read /workspace/1122/AGENTS.md before making changes and obey it as the authoritative engineering policy. Implement the supplied task specification, create the requested codex/* branch from main, run appropriate tests, commit, push, and open a pull request to main. Never merge the PR. Never expose credentials. Do not change business rules unless the task specification explicitly requires that change. If blocked, stop with a precise blocker instead of inventing behavior."""

    task_input = f"""Task ID: {task['task_id']}
Title: {task['title']}
Repository: {task['repository']}
Base branch: {task['base_branch']}
Required work branch: {task['work_branch']}

Authoritative task specification follows.

--- BEGIN SPEC ---
{spec}
--- END SPEC ---

Delivery requirements:
1. Work on exactly {task['work_branch']} from main.
2. Read AGENTS.md before editing.
3. Add/update tests for changed behavior.
4. Run relevant tests and record results in the PR body.
5. Push the branch and create a PR to main.
6. Do not merge the PR.
"""

    return {
        "environment": {
            "type": "openai_hosted",
            "network": {
                "access": "restricted",
                "allowed_domains": [
                    "github.com",
                    "api.github.com",
                    "raw.githubusercontent.com",
                    "objects.githubusercontent.com",
                    "registry.npmjs.org",
                    "pypi.org",
                    "files.pythonhosted.org"
                ],
            },
            "env": {
                "GH_TOKEN": github_token,
                "GITHUB_TOKEN": github_token,
                "GITHUB_REPOSITORY": REPOSITORY,
            },
            "setup_commands": [{"command": setup, "cwd": "/workspace"}],
        },
        "agent": {
            "name": "1122 Codex Cloud",
            "model": model,
            "instructions": instructions,
        },
        "input": task_input,
        "metadata": {
            "task_id": task["task_id"],
            "repository": REPOSITORY,
            "work_branch": task["work_branch"],
        },
    }


def api_json(url: str, *, method: str = "GET", token: str | None = None, payload: dict[str, Any] | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Accept", "application/json")
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")[:2000]
        raise DispatchError(f"HTTP {exc.code} from {url}: {body}") from exc
    except urllib.error.URLError as exc:
        raise DispatchError(f"request failed for {url}: {exc.reason}") from exc


def create_agent_session(payload: dict[str, Any], openai_key: str) -> dict[str, Any]:
    if not openai_key:
        raise DispatchError("OPENAI_API_KEY is missing")
    result = api_json(f"{OPENAI_BASE}/agents/sessions", method="POST", token=openai_key, payload=payload)
    if not isinstance(result, dict) or not result.get("id"):
        raise DispatchError("Agents API did not return a session id")
    return result


def wait_for_session(session_id: str, openai_key: str) -> dict[str, Any]:
    deadline = time.time() + MAX_WAIT_SECONDS
    latest: dict[str, Any] = {}
    while time.time() < deadline:
        latest = api_json(f"{OPENAI_BASE}/agents/sessions/{urllib.parse.quote(session_id, safe='')}", token=openai_key)
        if not isinstance(latest, dict):
            raise DispatchError("invalid Agents API session response")
        status = str(latest.get("status", "")).lower()
        if status in {"idle", "failed", "requires_action"}:
            return latest
        time.sleep(POLL_SECONDS)
    raise TimeoutError(f"Agents session exceeded {MAX_WAIT_SECONDS}s")


def github_get(path: str, github_token: str) -> Any:
    return api_json(f"https://api.github.com{path}", token=github_token)


def verify_github_delivery(task: dict[str, str], github_token: str) -> dict[str, Any]:
    owner, repo = REPOSITORY.split("/", 1)
    encoded_branch = urllib.parse.quote(task["work_branch"], safe="")
    branch_found = True
    try:
        github_get(f"/repos/{owner}/{repo}/branches/{encoded_branch}", github_token)
    except DispatchError:
        branch_found = False

    query = urllib.parse.urlencode({"state": "open", "head": f"{owner}:{task['work_branch']}", "base": BASE_BRANCH})
    prs = github_get(f"/repos/{owner}/{repo}/pulls?{query}", github_token)
    pr = prs[0] if isinstance(prs, list) and prs else None
    return {
        "branch_found": branch_found,
        "pr_found": bool(pr),
        "pr_number": pr.get("number") if isinstance(pr, dict) else None,
        "pr_url": pr.get("html_url") if isinstance(pr, dict) else None,
    }


def execute(task_path: Path, result_path: Path, checkout_root: Path) -> int:
    task_raw = json.loads(task_path.read_text(encoding="utf-8"))
    if not isinstance(task_raw, dict):
        raise DispatchError("task must be a JSON object")
    task = validate_task(task_raw)
    spec = read_spec(task, checkout_root)
    github_token = os.environ.get("GITHUB_TOKEN", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    model = os.environ.get("OPENAI_AGENT_MODEL", DEFAULT_MODEL)

    session_id = None
    result: dict[str, Any]
    exit_code = 1
    try:
        payload = build_session_payload(task, spec, github_token, model)
        session = create_agent_session(payload, openai_key)
        session_id = str(session["id"])
        terminal = wait_for_session(session_id, openai_key)
        status = str(terminal.get("status", "")).lower()
        delivery = verify_github_delivery(task, github_token)
        success = status == "idle" and delivery["branch_found"] and delivery["pr_found"]
        result = {
            "task_id": task["task_id"],
            "task_type": TASK_TYPE,
            "status": "SUCCEEDED" if success else ("REQUIRES_ACTION" if status == "requires_action" else "FAILED"),
            "completed_at": now_iso(),
            "agent_session_id": session_id,
            "agent_session_status": status,
            "work_branch": task["work_branch"],
            **delivery,
        }
        exit_code = 0 if success else 1
    except TimeoutError as exc:
        result = {
            "task_id": task["task_id"],
            "task_type": TASK_TYPE,
            "status": "TIMEOUT",
            "completed_at": now_iso(),
            "agent_session_id": session_id,
            "summary": str(exc),
        }
    except Exception as exc:
        result = {
            "task_id": task.get("task_id", "unknown"),
            "task_type": TASK_TYPE,
            "status": "FAILED",
            "completed_at": now_iso(),
            "agent_session_id": session_id,
            "summary": f"{type(exc).__name__}: {exc}",
        }

    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k not in {"summary"}}, ensure_ascii=False))
    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True)
    parser.add_argument("--result", required=True)
    parser.add_argument("--checkout-root", default=".")
    args = parser.parse_args()
    return execute(Path(args.task), Path(args.result), Path(args.checkout_root))


if __name__ == "__main__":
    sys.exit(main())
