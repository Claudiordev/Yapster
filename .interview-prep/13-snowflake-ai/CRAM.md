# 30-Minute Cram — Snowflake AI

*Read top to bottom. Bold lines are the ones to say out loud.*

## The one idea

**Choose the narrowest managed capability that solves the workload, and make its data semantics, access policy, evaluation, and cost explicit.** A natural-language interface is not a correctness or security guarantee.

## Map the product to the problem

| Need | Snowflake capability | What it does |
|---|---|---|
| Transform, classify, summarize, extract, or embed rows/documents | Cortex AI Functions / AISQL (`AI_*`) | Invoke task-specific or generative model functions in SQL/Python |
| Search unstructured text at low latency | Cortex Search | Managed hybrid lexical + vector retrieval with reranking |
| Natural language over governed structured data | Semantic Views + Cortex Analyst | Supplies business concepts, joins, metrics, and verified examples for SQL generation |
| Multi-step work across structured and unstructured data | Cortex Agents | Orchestrates tools such as Analyst, Search, Python code execution, and custom tools |
| Train and operate custom ML models | Snowflake ML / Snowpark ML | Feature Store, experiments, Model Registry, jobs, serving, lineage, observability |

Snowflake recommends Cortex Agents for new deployments that need Cortex Analyst capabilities; Analyst remains a core structured-data tool that agents can call.

## Cortex AI Functions

- `AI_COMPLETE`: general generation and transformation; prefer structured output/schema when downstream logic needs a predictable shape.
- `AI_CLASSIFY`, `AI_FILTER`: categorization and boolean filtering.
- `AI_EXTRACT`: structured facts from text or files; validate results and use confidence scores/human review where mistakes matter.
- `AI_PARSE_DOCUMENT`: convert documents to text/layout for downstream analysis and retrieval.
- `AI_EMBED`: vector representations for similarity workflows.
- `AI_SUMMARIZE`, `AI_TRANSLATE`, `AI_SENTIMENT`, `AI_AGG`, `AI_SIMILARITY`: task-specific functions for common analytics.
- `AI_*` functions are the primary current interface; review the migration guide when maintaining older `SNOWFLAKE.CORTEX.*` calls because some signatures and output contracts differ.
- Model choice, regions, cross-region inference, supported file types, role grants, and pricing vary. Verify current account/region availability.

## Retrieval augmented generation (RAG)

```
files → parse → clean / chunk / attach metadata → Cortex Search index
question → retrieve relevant chunks → prompt with evidence → answer with citations
```

- Cortex Search uses **hybrid retrieval**: vector similarity + keyword search + semantic reranking.
- Chunk around coherent, retrievable units; preserve document IDs, titles, dates, permissions, and source links as metadata.
- Tune for retrieval quality first: relevant top-k, filters, freshness, and citations. A fluent model cannot recover evidence that was not retrieved.
- A Cortex Search service is refreshed from a source query and has indexing/warehouse and serving costs. Set target lag and serving lifecycle based on freshness and traffic.
- **Cortex Search runs with owner’s rights.** A role that can query the service may see indexed data the role could not directly select from the source table. Design the service boundary and grants accordingly.

## Structured questions and agents

- Semantic Views describe logical tables, dimensions, facts, metrics, relationships, synonyms, and business rules. Good descriptions and verified query examples improve text-to-SQL reliability.
- Cortex Analyst generates and runs SQL using that semantic context; inspect generated SQL and constrain data access with Snowflake privileges.
- Cortex Agents add planning and tool orchestration. They can combine structured questions, Search retrieval, code execution, and custom tools; an agent with no data tools has no account data access.
- Put narrow tool scopes and clear instructions around actions. Use approval/human review for consequential writes or decisions.
- Agent outputs and citations can be wrong. Build a representative evaluation set, track answer correctness and retrieval quality, and inspect traces.

## Governance, quality, and cost

- Use least privilege, secure roles, masking/row access policies where suitable, and carefully designed service objects. Check owner-rights behavior and region/data-processing requirements.
- AI responses are probabilistic: use deterministic SQL/constraints for exact facts and business invariants; use model judgment for ambiguous language tasks.
- Evaluate by workflow: SQL correctness and metric accuracy; retrieval relevance/coverage; extraction precision/recall; answer grounding and citation support; latency and refusal behavior.
- Monitor traces, failures, token/credit usage, warehouse refresh costs, and Cortex Search serving costs. Budgets and quotas are product-specific; verify current support and timing.
- Prompt injection can arrive through user input or retrieved documents. Treat retrieved text as untrusted data, keep tools least-privileged, and add defense in depth; guardrails do not replace access control or output validation.

## Snowflake ML

- Snowpark ML supports feature engineering/training in Snowflake; Feature Store promotes reusable, consistent feature definitions and point-in-time-correct training data.
- Model Registry manages models and versions for inference; ML Jobs operationalize workflows; Observability monitors production drift/performance; lineage tracks data-to-feature-to-model relationships.
- Keep training-serving consistency, reproducibility, model versioning, drift monitoring, and rollback in the design.

## Interview answer pattern

**Name the use case → choose the feature → explain the data/semantic contract → secure it → evaluate quality → measure cost and operations.**

