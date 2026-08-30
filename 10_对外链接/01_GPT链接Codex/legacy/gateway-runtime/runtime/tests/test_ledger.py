from pathlib import Path

from gpt_codex_gateway.ledger import TaskLedger
from gpt_codex_gateway.models import TaskRecord, TaskStatus


def test_thread_mapping_and_task_roundtrip(tmp_path: Path) -> None:
    ledger = TaskLedger(tmp_path / "ledger.sqlite3")
    ledger.put_thread("amazon-agent", "conv-1", "thr-1")
    assert ledger.get_thread("amazon-agent", "conv-1") == "thr-1"

    task = TaskRecord(
        task_id="codex-1",
        project_id="amazon-agent",
        conversation_id="conv-1",
        thread_id="thr-1",
        turn_id="turn-1",
        status=TaskStatus.RUNNING,
        prompt_hash="abc123",
    )
    ledger.create_task(task)
    loaded = ledger.get_task("codex-1")
    assert loaded is not None
    assert loaded.prompt_hash == "abc123"
    assert loaded.status == TaskStatus.RUNNING

    completed = ledger.update_task("codex-1", status=TaskStatus.COMPLETED, result="PASS")
    assert completed.status == TaskStatus.COMPLETED
    assert completed.result == "PASS"


def test_restart_marks_inflight_unknown(tmp_path: Path) -> None:
    ledger = TaskLedger(tmp_path / "ledger.sqlite3")
    ledger.create_task(
        TaskRecord(
            task_id="codex-running",
            project_id="amazon-agent",
            conversation_id="conv",
            thread_id="thr",
            turn_id="turn",
            status=TaskStatus.RUNNING,
            prompt_hash="hash",
        )
    )
    assert ledger.mark_inflight_unknown() == 1
    assert ledger.get_task("codex-running").status == TaskStatus.UNKNOWN  # type: ignore[union-attr]
