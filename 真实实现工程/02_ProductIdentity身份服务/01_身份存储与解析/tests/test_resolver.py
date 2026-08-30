from datetime import UTC, datetime

from product_identity import (
    IdentityLookup,
    IdentityStatus,
    ProductIdentity,
    ProductIdentityService,
    ResolutionStatus,
)


def make_identity(product_id: str, **overrides) -> ProductIdentity:
    now = datetime(2026, 8, 30, 8, 0, tzinfo=UTC)
    data = {
        "product_id": product_id,
        "seller_account_id": "seller-001",
        "marketplace_id": "ATVPDKIKX0DER",
        "asin": f"B0{product_id[-3:]}TEST",
        "sku": f"SKU-{product_id[-3:]}",
        "identity_status": IdentityStatus.ACTIVE,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return ProductIdentity(**data)


def test_resolves_by_stable_product_id() -> None:
    service = ProductIdentityService()
    service.register(make_identity("prod-001"))
    result = service.resolve(IdentityLookup(product_id="prod-001"))
    assert result.status is ResolutionStatus.RESOLVED
    assert result.product_id == "prod-001"


def test_resolves_by_seller_marketplace_sku() -> None:
    service = ProductIdentityService()
    service.register(make_identity("prod-001", sku="SKU-SPECIAL"))
    result = service.resolve(
        IdentityLookup(
            seller_account_id="seller-001",
            marketplace_id="ATVPDKIKX0DER",
            sku="SKU-SPECIAL",
        )
    )
    assert result.status is ResolutionStatus.RESOLVED
    assert result.product_id == "prod-001"


def test_shared_asin_without_seller_is_ambiguous() -> None:
    service = ProductIdentityService()
    service.register(make_identity("prod-001", asin="B0SHARED01"))
    service.register(
        make_identity(
            "prod-002",
            seller_account_id="seller-002",
            asin="B0SHARED01",
        )
    )
    result = service.resolve(
        IdentityLookup(
            marketplace_id="ATVPDKIKX0DER",
            asin="B0SHARED01",
        )
    )
    assert result.status is ResolutionStatus.AMBIGUOUS
    assert set(result.candidate_product_ids) == {"prod-001", "prod-002"}


def test_shared_asin_with_seller_resolves_one_operating_product() -> None:
    service = ProductIdentityService()
    service.register(make_identity("prod-001", asin="B0SHARED01"))
    service.register(
        make_identity(
            "prod-002",
            seller_account_id="seller-002",
            asin="B0SHARED01",
        )
    )
    result = service.resolve(
        IdentityLookup(
            seller_account_id="seller-002",
            marketplace_id="ATVPDKIKX0DER",
            asin="B0SHARED01",
        )
    )
    assert result.status is ResolutionStatus.RESOLVED
    assert result.product_id == "prod-002"


def test_conflicting_product_id_and_sku_fail_closed() -> None:
    service = ProductIdentityService()
    service.register(make_identity("prod-001", sku="SKU-001"))
    service.register(make_identity("prod-002", sku="SKU-002"))
    result = service.resolve(
        IdentityLookup(
            product_id="prod-001",
            seller_account_id="seller-001",
            marketplace_id="ATVPDKIKX0DER",
            sku="SKU-002",
        )
    )
    assert result.status is ResolutionStatus.CONFLICT
    assert set(result.candidate_product_ids) == {"prod-001", "prod-002"}


def test_unknown_lookup_returns_not_found() -> None:
    service = ProductIdentityService()
    result = service.resolve(
        IdentityLookup(
            seller_account_id="seller-001",
            marketplace_id="ATVPDKIKX0DER",
            sku="MISSING-SKU",
        )
    )
    assert result.status is ResolutionStatus.NOT_FOUND
    assert result.product_id is None
