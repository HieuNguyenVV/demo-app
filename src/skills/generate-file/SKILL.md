---
name: generate-file
description: Use when the user wants a downloadable txt, md, json, csv, or pdf file.
---

# Generate file

Call `generate-file` when the user asks to create, export, or download a file.

## Input rules

- Set `fileName` without extension, for example `sales-report`.
- Choose `format`: `txt`, `md`, `json`, `csv`, or `pdf`.
- Put the full file body in `content`.
- For `json`, `content` must already be valid JSON.
- For `csv`, use comma-separated rows with the same number of columns in every row.
- For `pdf`, pass the plain text body in `content`; the backend renders it into a PDF.
- Use `title` for markdown headings or as the PDF title when helpful.

## After the tool returns

Tell the user the generated `fileName`, `sizeBytes`, and `lineCount` from `summary`.
Do not paste the full `content` into chat unless the user explicitly asks for it.
