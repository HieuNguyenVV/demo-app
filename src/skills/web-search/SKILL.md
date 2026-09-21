---
name: web-search
description: Use when the user wants to search the web, look up current facts, news, or "tại sao / tra cứu / tìm trên mạng". Call web-search instead of guessing.
---

# Web search

Call `web-search` when the user asks to search the internet, tra cứu, tin tức, or a factual question that needs live sources.

The app backend **rewrites** the query, then searches with OpenAI web search, and returns a grounded `summary` plus `sources`.

Do **not** use `generate-drawio` or `generate-sequencediagram` for this.

## Input

- `query`: the user's question **as they wrote it**. Do not rewrite, translate, or expand it yourself.

## After the tool returns

Answer from `summary`. Mention `rewrittenQuery` only if it clarifies the search.
Cite 2–5 items from `sources` (title + URL). Do not invent URLs or facts that are not in the result.
If `sourceCount` is 0, say the search found no citations and still share the summary cautiously.
