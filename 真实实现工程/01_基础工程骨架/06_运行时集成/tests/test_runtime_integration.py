import logging

import pytest
from pydantic import ValidationError

from runtime_integration import RuntimeContainer, build_application, build_runtime
from runtime_security import SecretUseBroker


def test_build_runtime_composes_settings_and_secret_broker() -> None:
    runtime = build_runtime(
        {
            "APP_ENV": "test",
            "LOG_LEVEL": "warning",
            "READ_ONLY_MODE": "true",
        }
    )

    assert isinstance(runtime, RuntimeContainer)
    assert runtime.settings.app_env == "test"
    assert runtime.settings.log_level == "WARNING"
    assert runtime.settings.read_only_mode is True
    assert isinstance(runtime.secret_broker, SecretUseBroker)
    assert not hasattr(runtime, "secret_provider")


def test_build_application_injects_single_runtime_container() -> None:
    app = build_application({"READ_ONLY_MODE": "true", "LOG_LEVEL": "info"})

    assert isinstance(app.state.runtime_container, RuntimeContainer)
    assert app.state.runtime_container.settings.read_only_mode is True
    assert logging.getLogger().level == logging.INFO


def test_runtime_fails_closed_before_application_when_write_mode_requested() -> None:
    with pytest.raises(ValidationError):
        build_application({"READ_ONLY_MODE": "false"})
