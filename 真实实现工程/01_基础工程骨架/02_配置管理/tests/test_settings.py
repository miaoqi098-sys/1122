import pytest
from pydantic import ValidationError

from configuration.settings import POLICY, load_settings


def test_defaults_are_read_only() -> None:
    settings = load_settings({})
    assert settings.read_only_mode is True
    assert settings.log_level == "INFO"
    assert settings.default_timezone == "UTC"


def test_non_secret_environment_override() -> None:
    settings = load_settings(
        {
            "APP_ENV": "test",
            "LOG_LEVEL": "debug",
            "DEFAULT_TIMEZONE": "America/Los_Angeles",
            "READ_ONLY_MODE": "true",
        }
    )
    assert settings.app_env == "test"
    assert settings.log_level == "DEBUG"
    assert settings.default_timezone == "America/Los_Angeles"


def test_write_mode_fails_closed() -> None:
    with pytest.raises(ValidationError):
        load_settings({"READ_ONLY_MODE": "false"})


def test_normal_config_policy_contains_no_secret_like_key() -> None:
    POLICY.assert_no_secret_keys()
