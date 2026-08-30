import pytest

from amazon_read_connector import AmazonApiFamily, ReadOperation, TransportRequest
from spapi_read import SpApiRoutingError, build_get_target, region_for_marketplace


def make_request(operation: ReadOperation, resource_id: str | None = None) -> TransportRequest:
    return TransportRequest(
        api_family=AmazonApiFamily.SP_API,
        operation=operation,
        seller_account_id="SELLER/TEST",
        marketplace_id="ATVPDKIKX0DER",
        resource_id=resource_id,
        correlation_id="corr-1",
        credential_ref_key="AMAZON/SP_API/READ_ONLY",
    )


def test_catalog_get_item_uses_na_official_host_and_marketplace_query() -> None:
    url, params = build_get_target(
        make_request(ReadOperation.SPAPI_CATALOG_GET_ITEM, "B0TEST/001")
    )
    assert url == "https://sellingpartnerapi-na.amazon.com/catalog/2022-04-01/items/B0TEST%2F001"
    assert params["marketplaceIds"] == "ATVPDKIKX0DER"


def test_listings_get_item_escapes_seller_and_sku() -> None:
    url, params = build_get_target(
        make_request(ReadOperation.SPAPI_LISTINGS_GET_ITEM, "SKU/ONE")
    )
    assert url.endswith("/listings/2021-08-01/items/SELLER%2FTEST/SKU%2FONE")
    assert params["marketplaceIds"] == "ATVPDKIKX0DER"


def test_inventory_summaries_has_marketplace_granularity() -> None:
    url, params = build_get_target(
        make_request(ReadOperation.SPAPI_INVENTORY_GET_SUMMARIES)
    )
    assert url.endswith("/fba/inventory/v1/summaries")
    assert params["granularityType"] == "Marketplace"
    assert params["granularityId"] == "ATVPDKIKX0DER"
    assert params["marketplaceIds"] == "ATVPDKIKX0DER"


def test_unknown_marketplace_fails_closed() -> None:
    request = make_request(ReadOperation.SPAPI_CATALOG_GET_ITEM, "B0TEST0001").model_copy(
        update={"marketplace_id": "UNKNOWN"}
    )
    with pytest.raises(SpApiRoutingError, match="unsupported marketplace_id"):
        build_get_target(request)


def test_known_us_marketplace_maps_to_na_region() -> None:
    assert region_for_marketplace("ATVPDKIKX0DER").value == "na"
