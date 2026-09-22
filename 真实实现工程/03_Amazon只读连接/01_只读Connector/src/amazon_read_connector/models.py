from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AmazonApiFamily(StrEnum):
    SP_API = "sp_api"
    ADS_API = "ads_api"


class ReadOperation(StrEnum):
    SPAPI_CATALOG_GET_ITEM = "spapi.catalog.get_item"
    SPAPI_LISTINGS_GET_ITEM = "spapi.listings.get_item"
    SPAPI_INVENTORY_GET_SUMMARIES = "spapi.inventory.get_summaries"
    ADS_CAMPAIGNS_LIST = "ads.campaigns.list"
    ADS_AD_GROUPS_LIST = "ads.ad_groups.list"
    ADS_KEYWORDS_LIST = "ads.keywords.list"


class ConnectorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    operation: ReadOperation
    seller_account_id: str = Field(min_length=1)
    marketplace_id: str = Field(min_length=1)
    resource_id: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(min_length=1)


class SourceTrace(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    api_family: AmazonApiFamily
    operation: ReadOperation
    seller_account_id: str
    marketplace_id: str
    observed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    correlation_id: str
    transport_request_id: str | None = None
    rate_limit: str | None = None
    response_status_code: int | None = None
    attempt_count: int = Field(ge=1)
    mock: bool = True


class ConnectorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    data: Any
    trace: SourceTrace


class TransportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    api_family: AmazonApiFamily
    operation: ReadOperation
    seller_account_id: str
    marketplace_id: str
    resource_id: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str
    credential_ref_key: str


class TransportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    payload: Any
    request_id: str | None = None
    rate_limit: str | None = None
    status_code: int | None = None
