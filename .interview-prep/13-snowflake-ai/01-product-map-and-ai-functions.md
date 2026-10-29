# 01 — Snowflake AI Product Map and AI Functions

Snowflake's AI surface spans managed SQL functions, search, text-to-SQL, agents, and custom ML. In an interview, explain the shape of the problem before naming a feature.

## Match the job to the capability

- **Per-row language task:** AI Functions / AISQL, such as classification, translation, sentiment, extraction, or generation.
- **Find useful passages in a corpus:** Cortex Search.
- **Ask business questions about tables and metrics:** a Semantic View with Cortex Analyst.
- **Combine tools over several steps:** Cortex Agents.
- **Train and deploy a task-specific model:** Snowflake ML / Snowpark ML with the Model Registry and serving options.

The boundaries matter. An agent is an orchestrator, not a guarantee of accuracy. Cortex Search retrieves candidates; it does not make the generator cite or correctly interpret them by itself. A Semantic View expresses business meaning; it does not replace grants or query validation.

## AI Functions / AISQL

AI Functions expose language and multimodal tasks through SQL and Python so they can be used in data workflows. Current function names include:

| Function | Typical use |
|---|---|
| `AI_COMPLETE` | General completion, rewriting, summarization, extraction, and structured output |
| `AI_CLASSIFY` | Assign one or more labels from a defined category set |
| `AI_FILTER` | Apply a natural-language yes/no condition |
| `AI_EXTRACT` | Extract structured fields from text or document files |
| `AI_PARSE_DOCUMENT` | Parse files into text and/or layout-aware content |
| `AI_EMBED` | Generate embeddings for semantic comparison or retrieval |
| `AI_SUMMARIZE`, `AI_TRANSLATE`, `AI_SENTIMENT` | Common text transformations and analysis |
| `AI_AGG`, `AI_SUMMARIZE_AGG` | Aggregate insights across sets of text records |

Choose the most specific function that fits. Prefer constrained categories or a structured schema over free-form text when the result feeds application logic. Validate types, required fields, and business rules after generation.

## Batch data pattern

```sql
SELECT ticket_id,
       AI_CLASSIFY(ticket_text, ['billing', 'access', 'bug', 'other']) AS category
FROM support_tickets;
```

For a production workload, do not assume this is free or exactly-once. Consider input size, token usage, retries, idempotence, failure capture, incremental processing, and evaluation of model output. Avoid rerunning expensive AI work for unchanged rows when a stable key/version strategy can cache or persist results.

## Current versus legacy interfaces

The current direction is the `AI_*` function interface. Older SQL often calls `SNOWFLAKE.CORTEX.*` functions such as `COMPLETE`, `SUMMARIZE`, or `SENTIMENT`. Do not mechanically rename without checking the migration guidance: arguments, return values, and behavior can change. Confirm regional and model availability before promising a specific model or latency.

## Cost and correctness

Consumption can include model/token usage, warehouse work, storage, and product-specific serving. Estimate on representative rows, record outputs and errors, and measure quality before scaling. For high-impact extraction, route uncertain values for review and use deterministic validation for dates, totals, identifiers, and allowed states.

## Official references

- [Cortex AISQL and AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/llm-functions)
- [AI Functions migration guide](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql-migrate-legacy-functions)
- [AI_EXTRACT reference](https://docs.snowflake.com/en/sql-reference/functions/ai_extract)
- [AI_EMBED reference](https://docs.snowflake.com/en/sql-reference/functions/ai_embed)

