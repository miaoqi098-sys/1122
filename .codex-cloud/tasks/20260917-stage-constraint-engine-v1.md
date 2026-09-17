# Engineering Task: Stage Engine V1 + Constraint Engine V1

Task ID: `20260917-stage-constraint-engine-v1`
Base branch: `main`
Work branch: `codex/stage-constraint-engine-v1`

## Authoritative business sources

Read these repository specifications before implementation:

- `运营板块/产品板块/产品推广计划/`
- `运营板块/每日工作SOP/`
- repository root `AGENTS.md`

The Product Promotion Plan V2 business model is: `Stage Engine -> Constraint Engine -> Strategy Engine`.
This task implements only the first two deterministic engines and the minimum hard-constraint integration needed to prove their outputs are usable by the later strategy/action layer.

## Objective

Implement the first deterministic decision layer for ProductPromotionPlan V2: a Stage Engine and Constraint Engine that can classify the product's current lifecycle stage, identify the primary/secondary operating constraint, explain the evidence used, and enforce hard operational constraints before scale recommendations.

Inspect the existing D1/domain models, decision services, types, schemas and test conventions before choosing implementation locations. Reuse existing architecture; do not create a parallel application stack.

## Stage Engine required output

Return a typed/structured result containing at minimum:

- `current_stage`
- `confidence`
- `why`
- `evidence`
- `data_sufficiency`
- `transition_recommendation`: `ADVANCE`, `HOLD`, or `REGRESS`

Use the V2 lifecycle vocabulary already defined by the business specification, including where applicable:

- `PRE_LAUNCH`
- `LAUNCH`
- `VALIDATION`
- `GROWTH`
- `SCALE`
- `MATURE`
- `REVALIDATION`
- `CLEARANCE`

Do not determine stage from listing age alone. Stage assessment must be based on operating maturity, goal completion, evidence sufficiency and risk state. Identical normalized inputs must produce identical outputs.

## Constraint Engine required output

Return a typed/structured result containing at minimum:

- `primary_constraint`
- `secondary_constraints`
- `confidence`
- `why`
- `evidence`

Supported constraint values:

- `TRAFFIC_CONSTRAINT`
- `CONVERSION_CONSTRAINT`
- `AD_EFFICIENCY_CONSTRAINT`
- `KEYWORD_RANK_CONSTRAINT`
- `PRICE_CONSTRAINT`
- `REVIEW_CONSTRAINT`
- `INVENTORY_CONSTRAINT`
- `PROFIT_CONSTRAINT`
- `LISTING_CONSTRAINT`
- `COMPETITIVE_CONSTRAINT`
- `POLICY_CONSTRAINT`
- `NO_MAJOR_CONSTRAINT`

If the existing codebase already has semantically equivalent values, reuse/migrate deliberately rather than duplicate types.

## Hard-constraint precedence

Hard operational constraints override growth/scale recommendations.

Minimum mandatory regression case:

Given:

- growth/performance evidence would otherwise support scaling;
- sellable inventory coverage = 18 days;
- replenishment lead time = 35 days;

Then the effective system must NOT recommend `SCALE_UP`.

Expected diagnosis/posture:

- primary constraint: `INVENTORY_CONSTRAINT`;
- effective scale posture: `HOLD_SCALE` (or an existing semantically equivalent action).

If architecture separates diagnosis from action planning, preserve that separation: Stage/Constraint engines return diagnosis and the existing/planned strategy layer applies the hard constraint. Do not collapse layers merely to satisfy this test.

## Data sufficiency

The engines must not invent missing evidence.

When required inputs are unavailable:

- return an explicit insufficient/partial data state;
- reduce confidence;
- do not fabricate values;
- do not produce high-confidence scale conclusions.

Reuse the repository's existing confidence/evidence representation if available.

## Explainability

Every classification must expose concise evidence and reasoning suitable for later UI/API display and debugging.

V1 should be deterministic and testable; do not implement the core classifier as opaque LLM-only logic.

## Integration requirements

1. Inspect existing Product Promotion Plan V2, Daily SOP V2, D1/domain models, recommendation/action types and tests.
2. Integrate with existing models instead of duplicating DTOs/enums.
3. Preserve backwards compatibility unless a deliberate migration is required and covered by tests.
4. Add tests for Stage Engine boundaries and Constraint Engine precedence.
5. Add at minimum these regression cases:
   - strong growth + inventory 18 days + replenishment 35 days => `INVENTORY_CONSTRAINT` and no `SCALE_UP` / effective `HOLD_SCALE`;
   - insufficient evidence => explicit insufficient-data state and non-high confidence;
   - healthy inputs with no material bottleneck => `NO_MAJOR_CONSTRAINT`;
   - stage is not inferred solely from listing age.
6. Run relevant existing tests plus new tests.
7. Do not modify unrelated UI, deployment, credentials, Amazon API authorization or production infrastructure.

## Acceptance criteria

The task is complete only when:

- Stage Engine and Constraint Engine are implemented in the existing architecture;
- outputs are typed/structured, deterministic and explainable;
- hard-constraint precedence is covered by automated tests;
- relevant tests pass;
- no unrelated files are changed;
- changes are committed to `codex/stage-constraint-engine-v1`;
- branch is pushed;
- a PR to `main` is created but NOT merged;
- PR body records implementation summary, tests run and blockers/limitations.

## Non-goals

- UI redesign
- Amazon production API calls
- automatic ad bid changes
- automatic pricing changes
- inventory purchasing/replenishment execution
- merging the PR
- modifying secrets/authentication configuration
