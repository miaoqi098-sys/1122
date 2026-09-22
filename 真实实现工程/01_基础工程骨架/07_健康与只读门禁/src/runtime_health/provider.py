from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from configuration import RuntimeSettings
from observability.health import DependencyHealth, ServiceHealth


class DependencyProbe(Protocol):
    name: str

    def check(self) -> DependencyHealth:
        """Return one sanitized dependency health snapshot."""


@dataclass(frozen=True)
class StaticDependencyProbe:
    name: str
    status: str
    detail: str | None = None

    def check(self) -> DependencyHealth:
        return DependencyHealth(name=self.name, status=self.status, detail=self.detail)  # type: ignore[arg-type]


class RuntimeHealthProvider:
    def __init__(
        self,
        settings: RuntimeSettings,
        probes: tuple[DependencyProbe, ...] = (),
    ) -> None:
        if settings.read_only_mode is not True:
            raise ValueError("runtime health provider refuses non-read-only settings")
        self._settings = settings
        self._probes = probes

    def snapshot(self) -> ServiceHealth:
        dependencies: list[DependencyHealth] = []
        for probe in self._probes:
            try:
                dependencies.append(probe.check())
            except Exception as exc:  # fail closed; never leak exception text
                dependencies.append(
                    DependencyHealth(
                        name=probe.name,
                        status="unavailable",
                        detail=f"probe_failed:{type(exc).__name__}",
                    )
                )

        statuses = {dependency.status for dependency in dependencies}
        if "unavailable" in statuses:
            status = "unavailable"
            ready = False
        elif statuses & {"degraded", "unknown"}:
            status = "degraded"
            ready = False
        else:
            status = "ok"
            ready = True

        return ServiceHealth(
            status=status,
            service=self._settings.service_name,
            ready=ready,
            dependencies=tuple(dependencies),
            write_capability=False,
        )
