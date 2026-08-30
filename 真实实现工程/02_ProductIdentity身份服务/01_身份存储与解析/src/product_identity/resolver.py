from __future__ import annotations

from .models import IdentityLookup, ResolutionResult, ResolutionStatus
from .store import InMemoryProductIdentityStore, ProductIdentityNotFound


class IdentityResolver:
    def __init__(self, store: InMemoryProductIdentityStore) -> None:
        self._store = store

    def resolve(self, lookup: IdentityLookup) -> ResolutionResult:
        direct = self._resolve_product_id(lookup)
        sku = self._resolve_sku(lookup)
        asin = self._resolve_asin(lookup)

        resolved_ids = {
            result.product_id
            for result in (direct, sku, asin)
            if result is not None
            and result.status is ResolutionStatus.RESOLVED
            and result.product_id is not None
        }
        if len(resolved_ids) > 1:
            return ResolutionResult(
                status=ResolutionStatus.CONFLICT,
                candidate_product_ids=tuple(sorted(resolved_ids)),
                strategy="cross_signal_consistency",
                reason="provided identity signals resolve to different product_id values",
            )

        terminal_results = [result for result in (direct, sku, asin) if result is not None]
        ambiguous_candidates = {
            product_id
            for result in terminal_results
            if result.status is ResolutionStatus.AMBIGUOUS
            for product_id in result.candidate_product_ids
        }
        if ambiguous_candidates:
            if resolved_ids:
                resolved_id = next(iter(resolved_ids))
                if resolved_id not in ambiguous_candidates:
                    return ResolutionResult(
                        status=ResolutionStatus.CONFLICT,
                        candidate_product_ids=tuple(sorted(ambiguous_candidates | resolved_ids)),
                        strategy="cross_signal_consistency",
                        reason="resolved signal conflicts with ambiguous candidate set",
                    )
            else:
                return ResolutionResult(
                    status=ResolutionStatus.AMBIGUOUS,
                    candidate_product_ids=tuple(sorted(ambiguous_candidates)),
                    strategy="multi_candidate",
                    reason="identity signals produced multiple candidate products",
                )

        if resolved_ids:
            product_id = next(iter(resolved_ids))
            strategies = [
                result.strategy
                for result in terminal_results
                if result.status is ResolutionStatus.RESOLVED
            ]
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                product_id=product_id,
                candidate_product_ids=(product_id,),
                strategy="+".join(strategies),
                reason="identity signals consistently resolved to one product",
            )

        return ResolutionResult(
            status=ResolutionStatus.NOT_FOUND,
            strategy="no_match",
            reason="no ProductIdentity matched the provided lookup",
        )

    def _resolve_product_id(self, lookup: IdentityLookup) -> ResolutionResult | None:
        if not lookup.product_id:
            return None
        try:
            identity = self._store.get(lookup.product_id)
        except ProductIdentityNotFound:
            return ResolutionResult(
                status=ResolutionStatus.NOT_FOUND,
                strategy="product_id",
                reason="product_id does not exist",
            )
        return ResolutionResult(
            status=ResolutionStatus.RESOLVED,
            product_id=identity.product_id,
            candidate_product_ids=(identity.product_id,),
            strategy="product_id",
            reason="matched stable internal product_id",
        )

    def _resolve_sku(self, lookup: IdentityLookup) -> ResolutionResult | None:
        if not lookup.sku:
            return None
        matches = self._store.find_by_sku(
            seller_account_id=lookup.seller_account_id or "",
            marketplace_id=lookup.marketplace_id or "",
            sku=lookup.sku,
        )
        return self._from_matches(matches, "seller_marketplace_sku")

    def _resolve_asin(self, lookup: IdentityLookup) -> ResolutionResult | None:
        if not lookup.asin:
            return None
        matches = self._store.find_by_asin(
            marketplace_id=lookup.marketplace_id or "",
            asin=lookup.asin,
            seller_account_id=lookup.seller_account_id,
        )
        return self._from_matches(matches, "marketplace_asin")

    @staticmethod
    def _from_matches(matches: tuple, strategy: str) -> ResolutionResult:
        if not matches:
            return ResolutionResult(
                status=ResolutionStatus.NOT_FOUND,
                strategy=strategy,
                reason="no matching ProductIdentity",
            )
        ids = tuple(sorted(identity.product_id for identity in matches))
        if len(ids) > 1:
            return ResolutionResult(
                status=ResolutionStatus.AMBIGUOUS,
                candidate_product_ids=ids,
                strategy=strategy,
                reason="multiple ProductIdentity candidates matched",
            )
        return ResolutionResult(
            status=ResolutionStatus.RESOLVED,
            product_id=ids[0],
            candidate_product_ids=ids,
            strategy=strategy,
            reason="exactly one ProductIdentity matched",
        )
