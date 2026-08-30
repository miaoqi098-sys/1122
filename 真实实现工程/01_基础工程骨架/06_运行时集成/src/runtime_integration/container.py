from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from fastapi import FastAPI

from app.main import create_app
from configuration import RuntimeSettings, load_settings
from observability.logging import configure_json_logging
from runtime_config_validation import validate_runtime_settings
from runtime_health import RuntimeHealthProvider
from secrets_runtime import EnvironmentSecretProvider, SecretProvider


@dataclass(frozen=True)
class RuntimeContainer:
    """Composition root for the read-only runtime.

    P1 components are created once here and injected into the application.
    Business modules must not create their own global settings, health provider,
    or secret provider.
    """

    settings: RuntimeSettings
    secret_provider: SecretProvider
    health_provider: RuntimeHealthProvider

    def create_application(self) -> FastAPI:
        configure_json_logging(self.settings.log_level)
        app = create_app(health_provider=self.health_provider)
        app.state.runtime_container = self
        return app


def build_runtime(environ: Mapping[str, str] | None = None) -> RuntimeContainer:
    settings = validate_runtime_settings(load_settings(environ))
    secret_provider = EnvironmentSecretProvider(environ)
    health_provider = RuntimeHealthProvider(settings)
    return RuntimeContainer(
        settings=settings,
        secret_provider=secret_provider,
        health_provider=health_provider,
    )


def build_application(environ: Mapping[str, str] | None = None) -> FastAPI:
    return build_runtime(environ).create_application()
