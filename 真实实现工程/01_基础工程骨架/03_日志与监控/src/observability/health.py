from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


DependencyStatus = Literal["ok", "degraded", "unavailable", "unknown"]


class DependencyHealth(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str = Field(min_length=1)
    status: DependencyStatus
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    detail: str | None = None


class ServiceHealth(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: DependencyStatus
    service: str = Field(min_length=1)
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    ready: bool
    dependencies: tuple[DependencyHealth, ...] = ()
    write_capability: Literal[False] = False

    def assert_read_only(self) -> None:
        """Backward-compatible assertion; construction already forbids write capability."""
        if self.write_capability is not False:
            raise ValueError("first implementation batch must remain read-only")
