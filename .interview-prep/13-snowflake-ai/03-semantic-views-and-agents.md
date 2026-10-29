# 03 — Semantic Views, Cortex Analyst, and Agents

## Semantic Views are the business contract

A Semantic View provides a governed, business-friendly description over Snowflake data. It can define logical tables, dimensions, facts, metrics, relationships, synonyms, comments, and instructions. This gives natural-language SQL generation explicit business context instead of asking a model to infer it from raw column names.

Invest in the semantic layer:

- Define the grain and primary keys of logical tables.
- Document ambiguous columns and business terms; add synonyms users actually say.
- Declare valid relationships and join paths to prevent accidental fan-out.
- Define metrics once with their filters, aggregation, and units.
- Add representative verified question/SQL examples where supported.
- Test ambiguous terms, time ranges, nulls, and requests that should be refused or clarified.

## Cortex Analyst

Cortex Analyst translates natural-language questions into SQL using the semantic context and can be used through an API. Review generated SQL, execution results, and user-visible explanations. Do not treat a syntactically valid query as a semantically correct metric.

Snowflake currently recommends transitioning to Cortex Agents for new solutions needing Analyst capabilities. Analyst is still a key tool in the agent architecture for structured questions.

## Cortex Agents

An Agent bundles its model/orchestration settings, instructions, and tools into a reusable object. The managed orchestration can plan, call tools, inspect intermediate results, and respond. Common tools include:

- Cortex Analyst for structured queries over Semantic Views.
- Cortex Search for retrieving unstructured evidence.
- Isolated Python code execution for calculations over results.
- Custom functions, procedures, or external tools for bounded business actions.

An agent with no data tools has only general model knowledge; it cannot query account data. Its access comes from Snowflake privileges and the configured tool execution context. Configure only the tools and data needed for the task.

## A design example

For “Compare this quarter’s sales trend and explain the main complaint themes”:

1. Analyst queries the sales Semantic View for exact, aggregate time-series data.
2. Search retrieves complaint passages from the relevant time period and product segment.
3. The agent combines the two outputs and cites document evidence.
4. A chart tool can visualize the numeric result.
5. Evaluation checks both metric correctness and whether the cited complaint evidence supports the explanation.

The separation matters: SQL is authoritative for exact totals; Search supports qualitative evidence; the model synthesizes only after both tools return results.

## Make tool use reliable

- Keep each tool narrow and provide descriptions of resources and columns.
- Spell out when the agent should query, search, ask a clarifying question, or decline.
- Do not give a read-only question-answer agent write-capable tools.
- Use deterministic authorization and validation around any action with side effects.
- Test multi-step paths, tool failures, empty results, ambiguous requests, and prompt injection in retrieved content.
- Inspect agent traces; an answer can sound confident even if it selected the wrong tool or misread a result.

## Official references

- [Cortex Analyst and Semantic Views](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst)
- [Cortex Agents](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents)
- [Cortex Agent evaluations](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-evaluations)

