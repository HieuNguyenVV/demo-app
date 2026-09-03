---
name: pdf-extract
description: Use when an office worker needs the text out of a PDF to paste into email, Word, or a form.
---

# Extract PDF text

Call `pdf` with `action: extract` when they ask to lấy chữ trong PDF, copy nội dung hợp đồng/báo cáo, or pull text for an email.

## Input

- `source: file` + `fileId`, or `source: platform` + `platformFileId`, or `source: base64` + `pdfBase64`.
- Optional `fileName` to label the source.

## After it returns

Use `extractedText` or `preview` to help them. Say the `pageCount`. Scanned image-only PDFs may return little or no text — say that honestly instead of inventing wording.
