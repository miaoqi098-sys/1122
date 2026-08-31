from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from .models import TaskRecord, TaskStatus, utc_now_iso


class TaskLedger:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS thread_map (
                    project_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    thread_id TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (project_id, conversation_id)
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    thread_id TEXT NOT NULL,
                    turn_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    prompt_hash TEXT NOT NULL,
                    result TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )

    def mark_inflight_unknown(self) -> int:
        with self._lock, self._connect() as conn:
            cursor = conn.execute(
                "UPDATE tasks SET status=?, updated_at=? WHERE status IN (?, ?, ?)",
                (
                    TaskStatus.UNKNOWN.value,
                    utc_now_iso(),
                    TaskStatus.STARTING.value,
                    TaskStatus.RUNNING.value,
                    TaskStatus.CANCEL_REQUESTED.value,
                ),
            )
            return cursor.rowcount

    def get_thread(self, project_id: str, conversation_id: str) -> str | None:
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT thread_id FROM thread_map WHERE project_id=? AND conversation_id=?",
                (project_id, conversation_id),
            ).fetchone()
            return str(row["thread_id"]) if row else None

    def put_thread(self, project_id: str, conversation_id: str, thread_id: str) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO thread_map(project_id, conversation_id, thread_id, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(project_id, conversation_id)
                DO UPDATE SET thread_id=excluded.thread_id, updated_at=excluded.updated_at
                """,
                (project_id, conversation_id, thread_id, utc_now_iso()),
            )

    def create_task(self, record: TaskRecord) -> TaskRecord:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO tasks(task_id, project_id, conversation_id, thread_id, turn_id, status,
                                  prompt_hash, result, error, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.task_id,
                    record.project_id,
                    record.conversation_id,
                    record.thread_id,
                    record.turn_id,
                    record.status.value,
                    record.prompt_hash,
                    record.result,
                    record.error,
                    record.created_at,
                    record.updated_at,
                ),
            )
        return record

    def update_task(
        self,
        task_id: str,
        *,
        status: TaskStatus | None = None,
        result: str | None = None,
        error: str | None = None,
    ) -> TaskRecord:
        current = self.get_task(task_id)
        if current is None:
            raise KeyError(task_id)
        updated = current.model_copy(
            update={
                "status": status or current.status,
                "result": result if result is not None else current.result,
                "error": error if error is not None else current.error,
                "updated_at": utc_now_iso(),
            }
        )
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE tasks SET status=?, result=?, error=?, updated_at=? WHERE task_id=?",
                (updated.status.value, updated.result, updated.error, updated.updated_at, task_id),
            )
        return updated

    def get_task(self, task_id: str) -> TaskRecord | None:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT * FROM tasks WHERE task_id=?", (task_id,)).fetchone()
        if not row:
            return None
        return TaskRecord(
            task_id=row["task_id"],
            project_id=row["project_id"],
            conversation_id=row["conversation_id"],
            thread_id=row["thread_id"],
            turn_id=row["turn_id"],
            status=TaskStatus(row["status"]),
            prompt_hash=row["prompt_hash"],
            result=row["result"],
            error=row["error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
