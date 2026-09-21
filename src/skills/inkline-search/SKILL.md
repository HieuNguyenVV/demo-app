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

The tool returns **source URLs only** (`sources`, `sourceCount`). It does **not** include an answer.

You write the reply in the user's language using those pages as evidence.
Cite 2–5 items from `sources` (title + URL). Do not invent URLs.
If `sourceCount` is 0, say the search found no pages.
