from gpt_codex_gateway.authority import AuthorityPolicy


def test_reversible_command_approval_is_automatic() -> None:
    policy = AuthorityPolicy()
    assert policy.approval_response(
        "item/commandExecution/requestApproval",
        {"command": "python -m pytest"},
    ) == {"decision": "accept"}


def test_disk_wipe_requires_hard_confirmation_and_is_declined() -> None:
    policy = AuthorityPolicy()
    assert policy.approval_response(
        "item/commandExecution/requestApproval",
        {"command": "diskpart /s clean.txt", "script": "select disk 0\nclean"},
    ) == {"decision": "decline"}


def test_secret_export_is_declined() -> None:
    policy = AuthorityPolicy()
    assert policy.is_hard_confirmation({"instruction": "export secret token to a text file"})
