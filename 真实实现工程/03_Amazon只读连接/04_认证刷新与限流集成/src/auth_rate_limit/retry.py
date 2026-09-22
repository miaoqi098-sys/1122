from __future__ import annotations

from dataclasses import dataclass
from time import sleep

from amazon_read_connector import ConnectorRateLimitError, ConnectorTimeoutError


@dataclass(frozen=True)
class ExponentialRetryDelayPolicy:
    base_delay_seconds: float = 0.25
    max_delay_seconds: float = 5.0

    def __post_init__(self) -> None:
        if self.base_delay_seconds < 0:
            raise ValueError("base_delay_seconds must be non-negative")
        if self.max_delay_seconds < 0:
            raise ValueError("max_delay_seconds must be non-negative")
        if self.base_delay_seconds > self.max_delay_seconds:
            raise ValueError("base_delay_seconds cannot exceed max_delay_seconds")

    def delay_seconds(self, *, error: Exception, attempt: int) -> float:
        if attempt < 1:
            raise ValueError("attempt must be >= 1")

        if isinstance(error, ConnectorRateLimitError):
            retry_after = error.retry_after_seconds
            if retry_after is not None:
                return min(self.max_delay_seconds, max(0.0, retry_after))

        if not isinstance(error, (ConnectorRateLimitError, ConnectorTimeoutError)):
            return 0.0

        exponential = self.base_delay_seconds * (2 ** (attempt - 1))
        return min(self.max_delay_seconds, exponential)


class SystemSleeper:
    def sleep(self, seconds: float) -> None:
        if seconds < 0:
            raise ValueError("sleep seconds must be non-negative")
        sleep(seconds)
