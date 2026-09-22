from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr


class SecretRef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    provider: Literal["environment", "vault"]
    key: str = Field(min_length=1, pattern=r"^[A-Z0-9_./:-]+$")
    purpose: str = Field(min_length=1)


class SecretValue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ref: SecretRef
    value: SecretStr

    def reveal_for_authorized_client(self) -> str:
        return self.value.get_secret_value()
