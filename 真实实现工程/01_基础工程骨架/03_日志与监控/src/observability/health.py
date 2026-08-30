from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


DependencyStatus = Literal["ok", "degraded", "unavailable", "unknown"]


class DependencyHealth(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    status: DependencyStatus
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    detail: str | None = None


class ServiceHealth(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: DependencyStatus
    service: str = Field(min_length=1)
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    dependencies: list[DependencyHealth] = Field(default_factory=list)
    write_capability: bool = False

    def assert_read_only(self) -> None:
        if self.write_capability:
            raise ValueError("first implementation batch must remain read-only")
