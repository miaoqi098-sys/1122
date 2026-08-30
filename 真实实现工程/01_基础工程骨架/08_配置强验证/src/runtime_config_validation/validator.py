from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from configuration import RuntimeSettings


ALLOWED_APP_ENVS = frozenset({"development", "test", "staging", "production"})
SUPPORTED_CONFIG_VERSIONS = frozenset({"1.0"})


class RuntimeConfigurationError(ValueError):
    pass


def validate_runtime_settings(settings: RuntimeSettings) -> RuntimeSettings:
    app_env = settings.app_env.strip().lower()
    if app_env not in ALLOWED_APP_ENVS:
        raise RuntimeConfigurationError(f"unsupported APP_ENV: {settings.app_env}")

    if settings.service_name.strip() != settings.service_name or not settings.service_name.strip():
        raise RuntimeConfigurationError("SERVICE_NAME must be non-empty and have no outer whitespace")

    if settings.config_version not in SUPPORTED_CONFIG_VERSIONS:
        raise RuntimeConfigurationError(
            f"unsupported CONFIG_VERSION: {settings.config_version}"
        )

    try:
        ZoneInfo(settings.default_timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise RuntimeConfigurationError(
            f"invalid DEFAULT_TIMEZONE: {settings.default_timezone}"
        ) from exc

    if settings.read_only_mode is not True:
        raise RuntimeConfigurationError("runtime must remain read-only")

    return settings
