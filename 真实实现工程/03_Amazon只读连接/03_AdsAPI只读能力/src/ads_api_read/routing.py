from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from amazon_read_connector import ReadOperation, TransportRequest

from .models import AdsProfile, AdsRegion


ADS_ENDPOINTS: dict[AdsRegion, str] = {
    AdsRegion.NA: "https://advertising-api.amazon.com",
    AdsRegion.EU: "https://advertising-api-eu.amazon.com",
    AdsRegion.FE: "https://advertising-api-fe.amazon.com",
}


@dataclass(frozen=True)
class AdsReadRoute:
    path: str
    media_type: str


ADS_READ_ROUTES: dict[ReadOperation, AdsReadRoute] = {
    ReadOperation.ADS_CAMPAIGNS_LIST: AdsReadRoute(
        path="/sp/campaigns/list",
        media_type="application/vnd.spCampaign.v3+json",
    ),
    ReadOperation.ADS_AD_GROUPS_LIST: AdsReadRoute(
        path="/sp/adGroups/list",
        media_type="application/vnd.spAdGroup.v3+json",
    ),
    ReadOperation.ADS_KEYWORDS_LIST: AdsReadRoute(
        path="/sp/keywords/list",
        media_type="application/vnd.spKeyword.v3+json",
    ),
}


def build_post_target(
    request: TransportRequest,
    profile: AdsProfile,
) -> tuple[str, Mapping[str, Any], str]:
    try:
        route = ADS_READ_ROUTES[request.operation]
    except KeyError as exc:
        raise ValueError("operation is not an Ads API read operation") from exc

    try:
        endpoint = ADS_ENDPOINTS[profile.region]
    except KeyError as exc:
        raise ValueError("unsupported Amazon Ads API region") from exc

    if profile.seller_account_id != request.seller_account_id:
        raise ValueError("Ads profile seller does not match transport request")
    if profile.marketplace_id != request.marketplace_id:
        raise ValueError("Ads profile marketplace does not match transport request")

    # List endpoints use POST as a read/query transport method. The semantic
    # operation is still constrained by the explicit ReadOperation allowlist.
    return f"{endpoint}{route.path}", dict(request.params), route.media_type
