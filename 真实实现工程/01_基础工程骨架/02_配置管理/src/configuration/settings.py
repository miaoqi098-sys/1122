from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping

from pydantic import BaseModel, ConfigDict, Field, field_validator


SECRET_LIKE_TOKENS = (
    "SECRET",
    "TOKEN",
    "PASSWORD",
    "PRIVATE_KEY",
    "ACCESS_KEY",
    "REFRESH_TOKEN",
    "CLIENT_SECRET",
)


class RuntimeSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_env: str = Field(default="development", min_length=1)
    service_name: str = Field(default="amazon-intelligent-operations-runtime", min_length=1)
    log_level: str = Field(default="INFO")
    read_only_mode: bool = True
    default_timezone: str = Field(default="UTC", min_length=1)
    config_version: str = "1.0"

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("unsupported LOG_LEVEL")
        return normalized

    @field_validator("read_only_mode")
    @classmethod
    def enforce_read_only(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("first implementation batch is read-only and fails closed")
        return value


@dataclass(frozen=True)
class ConfigSourcePolicy:
    allowed_environment_keys: tuple[str, ...] = (
        "APP_ENV",
        "SERVICE_NAME",
        "LOG_LEVEL",
        "READ_ONLY_MODE",
        "DEFAULT_TIMEZONE",
        "CONFIG_VERSION",
    )

    def assert_no_secret_keys(self) -> None:
        for key in self.allowed_environment_keys:
            upper_key = key.upper()
            if any(token in upper_key for token in SECRET_LIKE_TOKENS):
                raise RuntimeError(f"secret-like key is forbidden in normal config: {key}")


POLICY = ConfigSourcePolicy()


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError("READ_ONLY_MODE must be a boolean-like value")


def load_settings(environ: Mapping[str, str] | None = None) -> RuntimeSettings:
    POLICY.assert_no_secret_keys()
    source = os.environ if environ is None else environ

    values: dict[str, object] = {}
    mapping = {
        "APP_ENV": "app_env",
        "SERVICE_NAME": "service_name",
        "LOG_LEVEL": "log_level",
        "DEFAULT_TIMEZONE": "default_timezone",
        "CONFIG_VERSION": "config_version",
    }
    for env_key, field_name in mapping.items():
        if env_key in source:
            values[field_name] = source[env_key]

    if "READ_ONLY_MODE" in source:
        values["read_only_mode"] = _parse_bool(source["READ_ONLY_MODE"])

    return RuntimeSettings.model_validate(values)
