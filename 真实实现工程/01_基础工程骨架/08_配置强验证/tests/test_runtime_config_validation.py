import pytest

from configuration import RuntimeSettings
from runtime_config_validation import RuntimeConfigurationError, validate_runtime_settings


def test_accepts_supported_runtime_configuration() -> None:
    settings = RuntimeSettings(
        app_env="production",
        service_name="amazon-intelligent-operations-runtime",
        default_timezone="Asia/Shanghai",
        config_version="1.0",
        read_only_mode=True,
    )
    assert validate_runtime_settings(settings) is settings


def test_invalid_timezone_fails_closed() -> None:
    settings = RuntimeSettings(default_timezone="Mars/Olympus")
    with pytest.raises(RuntimeConfigurationError, match="invalid DEFAULT_TIMEZONE"):
        validate_runtime_settings(settings)


def test_unknown_app_env_fails_closed() -> None:
    settings = RuntimeSettings(app_env="prod-ish")
    with pytest.raises(RuntimeConfigurationError, match="unsupported APP_ENV"):
        validate_runtime_settings(settings)


def test_unsupported_config_version_fails_closed() -> None:
    settings = RuntimeSettings(config_version="2.0")
    with pytest.raises(RuntimeConfigurationError, match="unsupported CONFIG_VERSION"):
        validate_runtime_settings(settings)


def test_service_name_outer_whitespace_is_rejected() -> None:
    settings = RuntimeSettings(service_name=" runtime ")
    with pytest.raises(RuntimeConfigurationError, match="SERVICE_NAME"):
        validate_runtime_settings(settings)
