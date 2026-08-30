from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Protocol

from .models import SecretRef, SecretValue


class SecretProvider(Protocol):
    def resolve(self, ref: SecretRef) -> SecretValue:
        """Resolve one explicitly referenced secret without listing or logging secret values."""


class EnvironmentSecretProvider:
    def __init__(self, environ: Mapping[str, str] | None = None) -> None:
        self._environ = os.environ if environ is None else environ

    def resolve(self, ref: SecretRef) -> SecretValue:
        if ref.provider != "environment":
            raise ValueError("EnvironmentSecretProvider only accepts environment refs")
        try:
            raw_value = self._environ[ref.key]
        except KeyError as exc:
            raise LookupError(f"required secret reference is unavailable: {ref.key}") from exc
        if not raw_value:
            raise LookupError(f"required secret reference is empty: {ref.key}")
        return SecretValue(ref=ref, value=raw_value)
