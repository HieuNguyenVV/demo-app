---
name: pdf-analyze
description: Use when an office worker needs a short brief of a PDF before a meeting, filing, or forwarding to their manager.
---

# Analyze office PDF

Call `pdf` with `action: analyze` when they ask to tóm tắt PDF, đây là hợp đồng hay báo cáo gì, đọc giúp trước họp, or how long it takes to read.

## Input

Same sources as extract: `file`, `platform`, or `base64`.

## After it returns

Give a meeting-ready brief from `summary`, `pageCount`, `wordCount`, `readingMinutes`, and `topWords`. Do not dump the full `extractedText` unless they ask.
