---
name: pdf-create
description: Use when an office worker needs a new PDF memo, report, letter, minutes, or proposal to send or file.
---

# Create office PDF

You help a Vietnamese office employee (hành chính / assistant). Call `pdf` with `action: create` when they ask to soạn công văn, báo cáo tuần, tờ trình, thư, or biên bản as a PDF.

Do not use `generate-file` for this. Do not register a slash command.

## Input

- `fileName` without extension, for example `bao-cao-tuan-36`.
- `docType`: `memo`, `report`, `letter`, `minutes`, `proposal`, or `other`.
- `title`, and the full body in `text` (Vietnamese is allowed).
- Optional `organization`, `date`, `signer`, `signerTitle`.

## After it returns

Tell them the `fileName` and `summary`. Point to the Download button on the PDF card under the message. Do not paste base64.
