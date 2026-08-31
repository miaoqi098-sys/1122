from pathlib import Path

import pytest

from gpt_codex_gateway.app_server import (
    AppServerProtocolError,
    build_thread_start_params,
    build_turn_start_params,
    extract_thread_id,
    extract_turn_id,
    parse_json_line,
)


def test_initialize_protocol_line_is_json_object() -> None:
    assert parse_json_line(b'{"id":1,"result":{"ok":true}}\n')["id"] == 1
    with pytest.raises(AppServerProtocolError):
        parse_json_line("[]")


def test_extract_current_v2_ids() -> None:
    assert extract_thread_id({"id": 2, "result": {"thread": {"id": "thr_123"}}}) == "thr_123"
    assert extract_turn_id({"id": 3, "result": {"turn": {"id": "turn_456"}}}) == "turn_456"


def test_thread_start_uses_high_authority_defaults() -> None:
    params = build_thread_start_params(Path("/tmp/project"), "never", "danger-full-access")
    assert params["approvalPolicy"] == "never"
    assert params["sandbox"] == "danger-full-access"


def test_turn_start_shape_matches_v2_protocol() -> None:
    params = build_turn_start_params("thr", Path("/tmp/project"), "run tests", "test", "never")
    assert params == {
        "threadId": "thr",
        "input": [{"type": "text", "text": "run tests"}],
        "cwd": "/tmp/project",
        "title": "test",
        "approvalPolicy": "never",
    }
