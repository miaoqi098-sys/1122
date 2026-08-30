from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from pydantic import SecretStr

from secrets_runtime import SecretProvider, SecretRef, SecretValue


T = TypeVar("T")


class SecretConsumptionError(RuntimeError):
    pass


class SecretUseBroker:
    """Resolve a secret only for one authorized callback and never cache plaintext."""

    def __init__(self, provider: SecretProvider) -> None:
        self._provider = provider

    def use(self, ref: SecretRef, consumer: Callable[[str], T]) -> T:
        secret = self._provider.resolve(ref)
        plaintext = secret.reveal_for_authorized_client()
        result = consumer(plaintext)

        if isinstance(result, (SecretValue, SecretStr)):
            raise SecretConsumptionError("consumer must not return secret container values")
        if isinstance(result, str) and result == plaintext:
            raise SecretConsumptionError("consumer must not return the raw secret value")
        return result
