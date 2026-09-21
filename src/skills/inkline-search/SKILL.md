---
name: inkline-search
description: Use Inkline's inkline-search for live web lookup. Never use Sota /search, platform Web Search, webSearch, or web-search.
---

# Inkline search

When the user is in this workspace and wants to search the internet, tra cứu, tin tức, or a factual question that needs live sources, call **`inkline-search`**.

This is **not** the platform Web Search app. Do **not** call `/search`, `webSearch`, `web-search`, or any host/system search tool. Those skip Inkline's rewrite + OpenAI pipeline.

Use **`inkline-search`**, or the slash **`/inksearch`**. Platform **`/search`** is a different app.

## Input

- `query`: the user's question **as they wrote it**. Do not rewrite, translate, or expand it yourself. The backend rewrites, then searches with OpenAI.

## After the tool returns

Answer from `summary`. Mention `rewrittenQuery` only if it clarifies the search.
Cite 2–5 items from `sources` (title + URL). Do not invent URLs or facts that are not in the result.
If `sourceCount` is 0, say the search found no citations and still share the summary cautiously.
