from __future__ import annotations

from enum import StrEnum
from urllib.parse import quote

from amazon_read_connector import ReadOperation, TransportRequest


class SpApiRegion(StrEnum):
    NA = "na"
    EU = "eu"
    FE = "fe"


OFFICIAL_HOSTS = {
    SpApiRegion.NA: "https://sellingpartnerapi-na.amazon.com",
    SpApiRegion.EU: "https://sellingpartnerapi-eu.amazon.com",
    SpApiRegion.FE: "https://sellingpartnerapi-fe.amazon.com",
}

MARKETPLACE_REGIONS = {
    # North America
    "ATVPDKIKX0DER": SpApiRegion.NA,  # US
    "A2EUQ1WTGCTBG2": SpApiRegion.NA,  # CA
    "A1AM78C64UM0Y8": SpApiRegion.NA,  # MX
    "A2Q3Y263D00KWC": SpApiRegion.NA,  # BR
    # Europe / Middle East / India
    "A1F83G8C2ARO7P": SpApiRegion.EU,  # UK
    "A1PA6795UKMFR9": SpApiRegion.EU,  # DE
    "A13V1IB3VIYZZH": SpApiRegion.EU,  # FR
    "APJ6JRA9NG5V4": SpApiRegion.EU,  # IT
    "A1RKKUPIHCS9HS": SpApiRegion.EU,  # ES
    "A1805IZSGTT6HS": SpApiRegion.EU,  # NL
    "A2NODRKZP88ZB9": SpApiRegion.EU,  # SE
    "A1C3SOZRARQ6R3": SpApiRegion.EU,  # PL
    "AMEN7PMS3EDWL": SpApiRegion.EU,  # BE
    "A33AVAJ2PDY3EV": SpApiRegion.EU,  # TR
    "A2VIGQ35RCS4UG": SpApiRegion.EU,  # AE
    "A17E79C6D8DWNP": SpApiRegion.EU,  # SA
    "ARBP9OOSHTCHU": SpApiRegion.EU,  # EG
    "A21TJRUUN4KGV": SpApiRegion.EU,  # IN
    # Far East
    "A1VC38T7YXB528": SpApiRegion.FE,  # JP
    "A39IBJ37TRP1C6": SpApiRegion.FE,  # AU
    "A19VAU5U5O7RUS": SpApiRegion.FE,  # SG
}


class SpApiRoutingError(ValueError):
    pass


def region_for_marketplace(marketplace_id: str) -> SpApiRegion:
    try:
        return MARKETPLACE_REGIONS[marketplace_id]
    except KeyError as exc:
        raise SpApiRoutingError(f"unsupported marketplace_id: {marketplace_id}") from exc


def build_get_target(request: TransportRequest) -> tuple[str, dict[str, object]]:
    region = region_for_marketplace(request.marketplace_id)
    host = OFFICIAL_HOSTS[region]

    if request.operation is ReadOperation.SPAPI_CATALOG_GET_ITEM:
        if not request.resource_id:
            raise SpApiRoutingError("catalog get_item requires ASIN resource_id")
        path = f"/catalog/2022-04-01/items/{quote(request.resource_id, safe='')}"
        params: dict[str, object] = {"marketplaceIds": request.marketplace_id}
        params.update(request.params)
        return host + path, params

    if request.operation is ReadOperation.SPAPI_LISTINGS_GET_ITEM:
        if not request.resource_id:
            raise SpApiRoutingError("listings get_item requires SKU resource_id")
        seller = quote(request.seller_account_id, safe="")
        sku = quote(request.resource_id, safe="")
        path = f"/listings/2021-08-01/items/{seller}/{sku}"
        params = {"marketplaceIds": request.marketplace_id}
        params.update(request.params)
        return host + path, params

    if request.operation is ReadOperation.SPAPI_INVENTORY_GET_SUMMARIES:
        path = "/fba/inventory/v1/summaries"
        params = {
            "granularityType": "Marketplace",
            "granularityId": request.marketplace_id,
            "marketplaceIds": request.marketplace_id,
        }
        params.update(request.params)
        return host + path, params

    raise SpApiRoutingError(f"operation is not an SP-API GET capability: {request.operation}")
