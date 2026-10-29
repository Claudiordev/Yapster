# 04 — Governance, Operations, and Snowflake ML

## Security and governance

Start from existing Snowflake roles and least privilege. A user-facing agent should have only the tools and data needed for the request. Review owner-rights execution for managed services, including Cortex Search, and understand what the caller can indirectly retrieve through each object.

Consider:

- Which roles can call the function, query the service, use the Semantic View, or run the agent?
- Where are source data and model inference processed? Is cross-region inference enabled or required?
- Do masking, row access, and classification policies behave as intended across each AI surface?
- What input/output is logged, who can read traces, and how long are logs retained?
- Could a retrieved document contain prompt injection? Keep content separate from instructions and tools least-privileged.
- Which outputs need deterministic validation or human review?

Guardrails can add defense against prompt injection and unsafe outputs on supported products, but they do not grant or revoke data access and do not replace least privilege, validation, or evaluation.

## Evaluation and observability

Build a versioned evaluation dataset from representative and difficult requests, with ground truth or reviewer criteria. Measure the dimensions that match the application:

- Structured SQL: execution correctness, metric correctness, and result consistency.
- Search/RAG: retrieval relevance, coverage, answer grounding, and citation correctness.
- Extraction: field accuracy, confidence calibration, and human-review rate.
- Agents: task completion, tool choice, step correctness, safety/refusal, latency, and cost.

Use traces to diagnose which part failed: user intent, tool choice, SQL, retrieval, model synthesis, or output formatting. Keep evaluations separate from production user data where possible and control access to both prompts and outputs.

## Cost and operations

AI workloads can incur token/model charges plus warehouse, refresh, storage, or managed serving costs. Track use by function/service, estimate using representative inputs, and monitor both spend and quality. Cortex Search has distinct refresh and serving costs; an idle or over-fresh index can still create meaningful cost.

Choose target lag from a freshness requirement. Add bounded retries, timeouts, idempotent persistence, error capture, and a replay plan. Maintain a fallback for model or region unavailability if the business workflow needs one. Confirm current feature, region, model, edition, and privilege requirements before rollout.

## Snowflake ML / Snowpark ML

Snowflake ML supports more traditional supervised/unsupervised model workflows alongside Cortex generative AI features:

- **Feature Store:** reusable feature views and consistent feature pipelines; point-in-time-correct training data helps reduce leakage and training-serving skew.
- **Experiments:** record training runs, parameters, and metrics to compare candidate models.
- **Model Registry:** version and manage models trained inside or outside Snowflake for inference.
- **ML Jobs / runtime:** operationalize training and pipeline code.
- **Model serving:** deploy models for scalable inference, including through Snowpark Container Services where appropriate.
- **Observability and explainability:** monitor production behavior, drift, and feature attribution where supported.
- **ML Lineage:** trace data, features, datasets, and models for reproducibility and auditability.

Use custom ML when the task needs a model trained for a domain or predictive objective; use managed AI Functions when a general language task is enough. The right answer includes model lifecycle, data leakage controls, versioned artifacts, drift handling, and rollback—not just training code.

## Official references

- [Snowflake AI cost management and governance](https://docs.snowflake.com/en/user-guide/snowflake-cortex/governance-and-availability/ai-cost-management-and-governance)
- [Cortex AI Guardrails](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-ai-guardrails)
- [AI Observability](https://docs.snowflake.com/en/user-guide/snowflake-cortex/ai-observability)
- [Snowflake ML overview](https://docs.snowflake.com/en/developer-guide/snowflake-ml/overview)
- [Snowflake Feature Store overview](https://docs.snowflake.com/en/developer-guide/snowflake-ml/feature-store/overview)

