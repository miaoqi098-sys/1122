from __future__ import annotations

from .models import IdentityLookup, ProductIdentity, ResolutionResult
from .resolver import IdentityResolver
from .store import InMemoryProductIdentityStore


class ProductIdentityService:
    """Single V1 entry point for identity registration, lookup and resolution."""

    def __init__(self, store: InMemoryProductIdentityStore | None = None) -> None:
        self.store = store or InMemoryProductIdentityStore()
        self.resolver = IdentityResolver(self.store)

    def register(self, identity: ProductIdentity) -> ProductIdentity:
        return self.store.add(identity)

    def get(self, product_id: str) -> ProductIdentity:
        return self.store.get(product_id)

    def resolve(self, lookup: IdentityLookup) -> ResolutionResult:
        return self.resolver.resolve(lookup)
