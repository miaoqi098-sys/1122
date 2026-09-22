from __future__ import annotations

from collections import defaultdict

from .models import IdentityStatus, ProductIdentity


class IdentityConflictError(ValueError):
    pass


class ProductIdentityNotFound(KeyError):
    pass


class InMemoryProductIdentityStore:
    """V1 store used to freeze identity behavior before choosing a database."""

    def __init__(self) -> None:
        self._by_product_id: dict[str, ProductIdentity] = {}
        self._by_sku: dict[tuple[str, str, str], set[str]] = defaultdict(set)
        self._by_asin: dict[tuple[str, str], set[str]] = defaultdict(set)

    def add(self, identity: ProductIdentity) -> ProductIdentity:
        existing = self._by_product_id.get(identity.product_id)
        if existing is not None:
            if existing == identity:
                return existing
            raise IdentityConflictError(
                f"product_id already exists with different identity: {identity.product_id}"
            )

        if identity.sku:
            sku_key = self._sku_key(identity)
            existing_ids = self._by_sku.get(sku_key, set())
            if identity.identity_status is IdentityStatus.ACTIVE:
                active_conflicts = [
                    product_id
                    for product_id in existing_ids
                    if self._by_product_id[product_id].identity_status is IdentityStatus.ACTIVE
                ]
                if active_conflicts:
                    raise IdentityConflictError(
                        "active SKU mapping conflict for "
                        f"seller={identity.seller_account_id}, "
                        f"marketplace={identity.marketplace_id}, sku={identity.sku}; "
                        f"existing={sorted(active_conflicts)}"
                    )

        self._by_product_id[identity.product_id] = identity
        if identity.sku:
            self._by_sku[self._sku_key(identity)].add(identity.product_id)
        if identity.asin:
            self._by_asin[self._asin_key(identity)].add(identity.product_id)
        return identity

    def get(self, product_id: str) -> ProductIdentity:
        try:
            return self._by_product_id[product_id]
        except KeyError as exc:
            raise ProductIdentityNotFound(product_id) from exc

    def find_by_sku(
        self,
        *,
        seller_account_id: str,
        marketplace_id: str,
        sku: str,
    ) -> tuple[ProductIdentity, ...]:
        ids = self._by_sku.get((seller_account_id, marketplace_id, sku), set())
        return tuple(self._by_product_id[product_id] for product_id in sorted(ids))

    def find_by_asin(
        self,
        *,
        marketplace_id: str,
        asin: str,
        seller_account_id: str | None = None,
    ) -> tuple[ProductIdentity, ...]:
        ids = self._by_asin.get((marketplace_id, asin), set())
        identities = [self._by_product_id[product_id] for product_id in sorted(ids)]
        if seller_account_id is not None:
            identities = [
                identity
                for identity in identities
                if identity.seller_account_id == seller_account_id
            ]
        return tuple(identities)

    def list_all(self) -> tuple[ProductIdentity, ...]:
        return tuple(self._by_product_id[key] for key in sorted(self._by_product_id))

    @staticmethod
    def _sku_key(identity: ProductIdentity) -> tuple[str, str, str]:
        assert identity.sku is not None
        return identity.seller_account_id, identity.marketplace_id, identity.sku

    @staticmethod
    def _asin_key(identity: ProductIdentity) -> tuple[str, str]:
        assert identity.asin is not None
        return identity.marketplace_id, identity.asin
