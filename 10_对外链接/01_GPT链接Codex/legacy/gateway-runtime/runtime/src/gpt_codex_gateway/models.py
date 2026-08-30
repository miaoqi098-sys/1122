from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum

from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskStatus(StrEnum):
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    INTERRUPTED = "INTERRUPTED"
    UNKNOWN = "UNKNOWN"


class TaskRecord(BaseModel):
    task_id: str
    project_id: str
    conversation_id: str
    thread_id: str
    turn_id: str
    status: TaskStatus
    prompt_hash: str
    result: str | None = None
    error: str | None = None
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)


class GatewayStatus(BaseModel):
    gateway: str
    codex_binary: str | None
    app_server_process: str
    data_store: str
    approval_policy: str
    sandbox: str
