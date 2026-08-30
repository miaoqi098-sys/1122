from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from product_identity import IdentityLookup, IdentityStatus, ProductIdentity


def make_identity(**overrides):
    now = datetime(2026, 8, 30, 8, 0, tzinfo=UTC)
    data = {
        "product_id": "prod-001",
        "seller_account_id": "seller-001",
        "marketplace_id": "ATVPDKIKX0DER",
        "asin": "B0TEST0001",
        "sku": "SKU-001",
        "identity_status": IdentityStatus.ACTIVE,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return ProductIdentity(**data)


def test_product_identity_accepts_canonical_shape() -> None:
    identity = make_identity()
    assert identity.schema_version == "1.0"
    assert identity.product_id == "prod-001"


def test_product_identity_requires_asin_or_sku() -> None:
    with pytest.raises(ValidationError):
        make_identity(asin=None, sku=None)


def test_product_identity_is_frozen() -> None:
    identity = make_identity()
    with pytest.raises(ValidationError):
        identity.product_id = "prod-mutated"


def test_sku_lookup_requires_seller_and_marketplace() -> None:
    with pytest.raises(ValidationError):
        IdentityLookup(sku="SKU-001")


def test_asin_lookup_requires_marketplace() -> None:
    with pytest.raises(ValidationError):
        IdentityLookup(asin="B0TEST0001")
