# Stage Engine V1 + Constraint Engine V1

## TASK_ID
stage-constraint-engine-v1

## Goal
Implement the first Amazon AI Operator decision engine.

## Stage Engine
Determine the current ASIN operating stage.

Supported stages:
- PRE_LAUNCH
- LAUNCH
- VALIDATION
- GROWTH
- SCALE
- MATURE
- REVALIDATION
- CLEARANCE

Output:
- current_stage
- confidence
- reason
- evidence

## Constraint Engine
Determine the primary business bottleneck.

Supported constraints:
- TRAFFIC
- CONVERSION
- AD_EFFICIENCY
- KEYWORD_RANK
- PRICE
- REVIEW
- INVENTORY
- PROFIT
- LISTING
- COMPETITIVE
- POLICY
- NO_MAJOR_CONSTRAINT

Output:
- primary_constraint
- secondary_constraints
- evidence
- recommended_strategy

## Acceptance Criteria
- Logic is separated from data access.
- Tests cover stage transitions.
- Tests cover conflicting signals.
- Output is explainable.
- Create PR after implementation.
