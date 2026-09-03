---
name: pdf-analyze
description: Use when an office worker attaches a PDF in chat and asks to analyze, summarize, or brief it — or when they want a brief of a PDF this app already created.
---

# Analyze office PDF

Call `pdf` with `action: analyze` immediately when they ask to tóm tắt PDF, phân tích PDF, đọc giúp trước họp, or how long it takes to read.

The user does **not** need to say "upload". If they attached a `.pdf` and asked to analyze or summarize it, call `pdf` now. Do **not** use `upload-file` / `analyze-file` for PDFs.

## Trigger examples

- "Phân tích PDF này"
- "Tóm tắt file đính kèm"
- "Đọc giúp trước họp"
- "Analyze this PDF"

## Chat attachment (same workaround as upload-file)

- `source: "platform"`
- `platformFileId`
- `fileName` such as `hop-dong.pdf`
- `content`: full attachment text visible in the conversation (do not summarize)

If 401 / PLATFORM_FILE_ERROR, retry once with `content`.

If no attachment text is visible, say you cannot read a scanned PDF from chat.

## PDF this app already created

`source: "file"` + `fileId` from pdf create/edit.

## After it returns

Brief from `summary`, `pageCount`, `wordCount`, `readingMinutes`, and `topWords`. Do not dump `extractedText` unless they ask.
