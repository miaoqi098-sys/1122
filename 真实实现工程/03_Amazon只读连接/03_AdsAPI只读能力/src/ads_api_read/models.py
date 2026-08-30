from __future__ import annotations

from enum import StrEnum
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field


class AdsRegion(StrEnum):
    NA = "NA"
    EU = "EU"
    FE = "FE"


class AdsProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    profile_id: str = Field(min_length=1)
    seller_account_id: str = Field(min_length=1)
    marketplace_id: str = Field(min_length=1)
    region: AdsRegion


class AdsProfileResolver(Protocol):
    def resolve(self, *, seller_account_id: str, marketplace_id: str) -> AdsProfile:
        ...


class StaticAdsProfileResolver:
    """Deterministic resolver for tests/configured single-account runtime."""

    def __init__(self, profiles: tuple[AdsProfile, ...]) -> None:
        self._profiles = {
            (profile.seller_account_id, profile.marketplace_id): profile
            for profile in profiles
        }
        if len(self._profiles) != len(profiles):
            raise ValueError("duplicate Ads profile mapping")

    def resolve(self, *, seller_account_id: str, marketplace_id: str) -> AdsProfile:
        key = (seller_account_id, marketplace_id)
        try:
            return self._profiles[key]
        except KeyError as exc:
            raise LookupError(
                "Ads profile mapping unavailable for seller/marketplace"
            ) from exc
