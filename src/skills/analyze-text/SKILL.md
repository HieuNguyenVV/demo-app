---
name: analyze-text
description: Use for pasted inline text or bundled app sample files — not for chat attachments.
---

# Analyze text

Use `analyze-text` when the user wants more than a raw word count:

- reading time estimate
- sentence count and average word length
- frequent keywords
- analysis of an app-owned sample file

## Input rules

- For pasted or quoted content **without a chat attachment**, set `source: "text"` and pass the full `text`.
- For bundled demo files, set `source: "file"` and choose:
  - `sample-article.txt` for the product explainer
  - `sample-notes.txt` for the short checklist

## Chat attachments

If the user attached a file in chat, do **not** use `analyze-text`.
Use `upload-file` then `analyze-file` instead, even when the user only says "đọc", "phân tích", or "analyze".

Prefer `count-words` only when the user asks for a quick exact total and nothing else.

Report the returned `summary` and key counts. Do not guess stats yourself when this tool is available.
