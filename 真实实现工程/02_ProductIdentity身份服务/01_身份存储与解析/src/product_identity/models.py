from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class IdentityStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
    UNKNOWN = "unknown"


class ProductIdentity(BaseModel):
    """Canonical runtime representation of ProductIdentity V1.0."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: str = Field(default="1.0", pattern=r"^1\.0$")
    product_id: str = Field(min_length=1)
    seller_account_id: str = Field(min_length=1)
    marketplace_id: str = Field(min_length=1)
    asin: str | None = None
    sku: str | None = None
    fnsku: str | None = None
    parent_asin: str | None = None
    parent_product_id: str | None = None
    variation_family_id: str | None = None
    product_name: str | None = None
    identity_status: IdentityStatus
    source_refs: tuple[str, ...] = ()
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def require_external_identity(self) -> "ProductIdentity":
        asin = self.asin.strip() if self.asin else ""
        sku = self.sku.strip() if self.sku else ""
        if not asin and not sku:
            raise ValueError("ProductIdentity requires at least one non-empty asin or sku")
        return self


class ResolutionStatus(StrEnum):
    RESOLVED = "resolved"
    NOT_FOUND = "not_found"
    AMBIGUOUS = "ambiguous"
    CONFLICT = "conflict"


class IdentityLookup(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    product_id: str | None = None
    seller_account_id: str | None = None
    marketplace_id: str | None = None
    asin: str | None = None
    sku: str | None = None

    @model_validator(mode="after")
    def require_lookup_key(self) -> "IdentityLookup":
        if not any((self.product_id, self.asin, self.sku)):
            raise ValueError("IdentityLookup requires product_id, asin, or sku")
        if self.sku and not (self.seller_account_id and self.marketplace_id):
            raise ValueError("sku lookup requires seller_account_id and marketplace_id")
        if self.asin and not self.marketplace_id:
            raise ValueError("asin lookup requires marketplace_id")
        return self


class ResolutionResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: ResolutionStatus
    product_id: str | None = None
    candidate_product_ids: tuple[str, ...] = ()
    strategy: str
    reason: str

    @model_validator(mode="after")
    def validate_resolution_shape(self) -> "ResolutionResult":
        if self.status is ResolutionStatus.RESOLVED and not self.product_id:
            raise ValueError("resolved result requires product_id")
        if self.status is not ResolutionStatus.RESOLVED and self.product_id is not None:
            raise ValueError("non-resolved result must not expose product_id")
        return self
