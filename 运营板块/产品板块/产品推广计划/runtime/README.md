# Stage Engine V1 + Constraint Engine V1 runtime

This directory is the deterministic, read-only decision layer for the first two engines in `ProductPromotionPlan V2`:

```text
normalized operating facts
  -> Stage Engine V1
  -> Constraint Engine V1
  -> later Strategy / Action layers
```

The runtime never reads D1/KV/API data, writes a `ProductStage`, creates a Task, or authorizes an Amazon, Ads, inventory, price, or listing change. Data access belongs to the existing collectors and domain adapters. They must provide normalized facts with evidence references; the engines only classify those facts.

## Stage input

`evaluateStage(input)` accepts an optional confirmed `current_stage` and an evidence envelope for every signal it uses:

```js
{
  current_stage: 'GROWTH',
  current_stage_evidence: {
    confidence: 0.9,
    evidence_refs: ['business-state://...']
  },
  signals: {
    sales_growth_sustained: { value: true, confidence: 0.9, evidence_refs: ['metric://...'] },
    target_keyword_momentum_positive: { value: true, confidence: 0.9, evidence_refs: ['keyword://...'] },
    tacos_within_tolerance: { value: true, confidence: 0.9, evidence_refs: ['ads://...'] },
    contribution_margin_after_ads_positive: { value: true, confidence: 0.9, evidence_refs: ['finance://...'] },
    inventory_buffer_sufficient: { value: true, confidence: 0.9, evidence_refs: ['inventory://...'] },
    review_health: { value: 'HEALTHY', confidence: 0.9, evidence_refs: ['review://...'] },
    price_health: { value: 'HEALTHY', confidence: 0.9, evidence_refs: ['price://...'] },
    policy_block: { value: false, confidence: 0.9, evidence_refs: ['policy://...'] }
  }
}
```

The result contains the existing Product Promotion Plan assessment fields (`current_stage`, `confidence`, `reason`, `supporting_evidence`, transition candidates) plus task-required `why`, `evidence`, `data_sufficiency`, and `transition_recommendation`. Its read-only `transition` audit carries `from_stage`, `to_stage`, reason, evidence references, and confidence; `stage_since` is preserved only for a held confirmed stage, normalized to the existing schema's `YYYY-MM-DD` date format, because a persistence layer must establish the timestamp for a newly written `ProductStage`. `UNKNOWN` is the existing schema's safe non-lifecycle outcome when evidence is incomplete. `listing_age_days` is intentionally ignored.

The documented rollback paths are accepted only when normalized upstream facts explicitly evidence `validation_revalidation_required`, `growth_regression_required`, or `scale_regression_required`. Missing forward-stage evidence alone never causes a lifecycle rollback.

## Constraint input and hard guardrails

`evaluateConstraints(input)` receives evidence-backed candidates from the Signal/Root Cause layer. Candidate values reuse the existing Product Promotion Plan V2 constraint enum, for example `TRAFFIC_CONSTRAINT` and `INVENTORY_CONSTRAINT`; this runtime does not introduce a second constraint vocabulary.

For the mandatory inventory boundary, pass either a normalized inventory object:

```js
{
  inventory: {
    coverage_days: 18,
    lead_time_days: 35,
    safety_stock_days: 0,
    freshness: 'fresh',
    confidence: 0.9,
    evidence_refs: ['inventory://...']
  }
}
```

or the existing Agent-7 result shape. When the full Agent-7 result is supplied, the adapter prefers its normalized canonical metrics while also accepting the formal event's `evidence[].ref` and `source_refs` fields. A bare formal event that does not carry lead-time metrics remains explicitly partial rather than causing the engine to infer them. The engine exposes `effective_scale_posture: 'HOLD_SCALE'` and blocks `SCALE_UP` when coverage is below lead time plus any supplied safety-stock buffer. This is a diagnostic guardrail for the later Strategy layer, not an operational action or authorization.

With incomplete or tied evidence, the engines return an explicit insufficient/partial state, conservative confidence, and no scale-up conclusion. A candidate tie intentionally produces `UNKNOWN` rather than inventing a permanent global priority chain.

## Verification

```powershell
node --check '运营板块/产品板块/产品推广计划/runtime/stage-constraint-engine-v1.js'
node '运营板块/产品板块/产品推广计划/runtime/stage-constraint-engine-v1.test.js'
node '运营板块/产品板块/产品推广计划/runtime/stage-constraint-agent7.integration.test.mjs'
```
