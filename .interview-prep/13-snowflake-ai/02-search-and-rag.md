# 02 — Cortex Search and RAG

## When Search fits

Cortex Search is for retrieving relevant information from unstructured text. It provides a managed, low-latency search endpoint and combines lexical retrieval, vector retrieval, and semantic reranking. Use it for enterprise search or as the retrieval layer of a RAG application.

For numeric aggregates or exact business metrics, query structured data through SQL and a Semantic View. Search's top-k sample is not a substitute for scanning a full corpus when a user asks for a count or trend.

## A production RAG flow

1. Ingest documents with stable IDs, versions, timestamps, source URI, tenant/security metadata, and provenance.
2. Parse and normalize text. Preserve headings and useful layout; do not blindly split every fixed number of characters.
3. Chunk at a size that keeps useful context while allowing precise retrieval. Keep parent-document metadata on each chunk.
4. Build a Cortex Search service over the searchable text and filterable attributes.
5. Retrieve a measured number of candidates, apply valid access filters, and pass only relevant evidence to the generation step.
6. Return citations tied to document IDs and source locations. Log retrieval IDs and the final response for review.
7. Evaluate with real questions and known relevant documents; iterate on parsing, chunking, metadata, filters, ranking, and prompt format.

## Quality diagnosis

Separate retrieval quality from generation quality:

- **Relevant evidence absent from top results:** inspect indexing, parsing, chunk boundaries, query rewriting, filters, and ranking.
- **Evidence retrieved but answer wrong:** inspect prompt construction, context ordering/length, conflicting evidence, model selection, and output checks.
- **Correct answer with weak citations:** preserve source metadata per chunk and require claims to map to returned source references.
- **Good demo, poor production:** evaluate user query distribution, document freshness, ACL edge cases, latency, and failure/retry behavior.

Measure retrieval recall/precision at k and answer groundedness/correctness separately. A single “looks good” demo is not an evaluation set.

## Service lifecycle and cost

A Cortex Search Service materializes and indexes the result of a source query. Its refresh behavior is controlled by a target lag and supported refresh pattern. Costs can include warehouse compute for refresh/indexing, embedding tokens for changed documents, storage, and separate serving compute while serving is active. More frequent refresh and more indexed columns/documents can raise cost.

Align freshness with the business need. Monitor refresh failures and lag. Use an isolated warehouse while establishing refresh cost where useful, and account for serving cost independently from query warehouse cost.

## Critical security model: owner’s rights

Cortex Search queries run with the service owner's rights. A user with permission to query the Search service may receive indexed rows even if that user's role cannot read the underlying source table. Therefore:

- Treat each Search service as a data-access boundary.
- Include only data appropriate for every role allowed to query it.
- Enforce tenant and sensitivity boundaries in service design and query filters, not only in source-table grants.
- Review grants, service ownership, masking/row policies, and the exact behavior before exposing an endpoint.

## Official references

- [Cortex Search overview](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-overview)
- [Query a Cortex Search Service](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/query-cortex-search-service)
- [Cortex Search cost considerations](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-search/cortex-search-costs)

