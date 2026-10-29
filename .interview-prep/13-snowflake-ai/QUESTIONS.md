# Interview Questions — Senior Snowflake AI

Answers are the short spoken version. Explain the security and quality boundary as well as the product feature.

## Product choices

**⭐ Which Snowflake AI feature would you use for a given use case?**
For per-row language work I start with AI Functions. For unstructured low-latency retrieval I use Cortex Search. For natural-language questions over governed business metrics I define a Semantic View and use Cortex Analyst, often through Cortex Agents for new multi-tool workflows. For custom predictive models I use Snowflake ML/Snowpark ML and the Model Registry.

**Cortex Search versus Cortex Analyst?**
Search retrieves relevant unstructured content with hybrid lexical/vector retrieval and reranking. Analyst generates SQL over structured data using semantic business metadata. Search is good for “find evidence”; Analyst is for “calculate the metric.”

**What does Cortex Agents add?**
Managed planning and tool orchestration across capabilities such as Analyst, Search, code execution, and custom tools. It supports multi-step requests, but correct answers still depend on tool definitions, data semantics, permissions, and evaluation.

## Data and answer quality

**⭐ How would you build RAG on Snowflake?**
Parse documents, preserve stable source and access metadata, chunk coherent passages, index them in Cortex Search, retrieve relevant evidence with filters, then generate an answer grounded in the retrieved passages with citations. I evaluate retrieval and answer quality separately and monitor freshness and cost.

**How do you improve text-to-SQL reliability?**
Model the business layer with Semantic Views: declare grain, relationships, metrics, synonyms, and column descriptions, then add verified examples and test ambiguous queries. I inspect generated SQL and validate results against known answers.

**How do you know whether a RAG failure is retrieval or generation?**
Inspect the retrieved passages first. If relevant evidence is absent, fix parsing, chunking, metadata, filters, or ranking. If evidence is present but the answer is wrong or unsupported, fix context construction, instructions, model behavior, or output validation.

**When should you use an LLM versus SQL?**
SQL and constraints for exact metrics, joins, and invariants; a model for language understanding, summarization, or synthesis. In a combined workflow, fetch exact facts with SQL and let the model explain them without recalculating authoritative totals.

## Security and governance

**⭐ What security issue must you check with Cortex Search?**
Search runs with owner’s rights. A caller who can query the service may see indexed rows their own role cannot select from the source table. So I treat each service as an access boundary, minimize indexed data, design grants and filters carefully, and test with the actual caller roles.

**Does Cortex Search or an Agent inherit all source-table row-level policies for each end user?**
I would not assume that. I verify the execution model for each configured tool and service. In particular, Cortex Search's owner-rights behavior means source-table grants alone may not restrict results for service users.

**How do you handle prompt injection in retrieved documents?**
Treat retrieved content as untrusted data, separate it from system instructions, use least-privileged tools, validate outputs, and test attack-shaped content. Product guardrails can add protection where supported but are not the access-control boundary.

**What must you confirm before selecting a model?**
Region and feature availability, cross-region inference configuration, allowed-model controls, latency, quality, cost, and data-handling requirements. Model availability and defaults change, so I verify current account documentation rather than hard-coding assumptions.

## Operations and evaluation

**How would you evaluate an AI agent?**
Use a versioned set of real, edge, ambiguous, and adversarial requests. Score task outcome, tool choice, SQL/retrieval correctness, groundedness/citations, safety, latency, and cost; then inspect traces and failure categories rather than only the final response.

**What drives Cortex Search cost?**
Refresh work and embeddings for changed text, indexed storage, and separate serving compute. Target lag, source change rate, indexed volume, and number of indexed columns affect cost. I set freshness from a product requirement, measure each cost component, and monitor failures and lag.

**How do you make AI batch processing dependable?**
Persist outputs with stable source versions, process incrementally, capture errors, make retries bounded and idempotent, validate the schema and business rules, and route uncertain or high-impact outputs for review.

**When would you choose Snowflake ML instead of an AI Function?**
When the task needs a custom trained predictive model, domain-specific objective, or controlled inference lifecycle. I use Feature Store and point-in-time data for consistent features, Model Registry for versioning, and observability for drift and rollback.

