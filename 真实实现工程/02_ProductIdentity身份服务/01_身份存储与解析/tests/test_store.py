from datetime import UTC, datetime

import pytest

from product_identity import (
    IdentityConflictError,
    IdentityStatus,
    InMemoryProductIdentityStore,
    ProductIdentity,
    ProductIdentityNotFound,
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


def test_store_registers_and_reads_by_product_id() -> None:
    store = InMemoryProductIdentityStore()
    identity = make_identity("prod-001")
    store.add(identity)
    assert store.get("prod-001") == identity


def test_store_rejects_changed_record_for_existing_product_id() -> None:
    store = InMemoryProductIdentityStore()
    store.add(make_identity("prod-001"))
    with pytest.raises(IdentityConflictError):
        store.add(make_identity("prod-001", product_name="changed"))


def test_store_rejects_duplicate_active_sku_mapping() -> None:
    store = InMemoryProductIdentityStore()
    store.add(make_identity("prod-001", sku="SHARED-SKU"))
    with pytest.raises(IdentityConflictError):
        store.add(
            make_identity(
                "prod-002",
                asin="B0OTHER002",
                sku="SHARED-SKU",
            )
        )


def test_store_allows_same_asin_for_different_sellers() -> None:
    store = InMemoryProductIdentityStore()
    store.add(make_identity("prod-001", asin="B0SHARED01"))
    store.add(
        make_identity(
            "prod-002",
            seller_account_id="seller-002",
            asin="B0SHARED01",
        )
    )
    matches = store.find_by_asin(
        marketplace_id="ATVPDKIKX0DER",
        asin="B0SHARED01",
    )
    assert {item.product_id for item in matches} == {"prod-001", "prod-002"}


def test_missing_product_id_fails_closed() -> None:
    store = InMemoryProductIdentityStore()
    with pytest.raises(ProductIdentityNotFound):
        store.get("missing")
