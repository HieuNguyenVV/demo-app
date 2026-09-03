---
name: pdf-extract
description: Use when an office worker attaches a PDF in chat and asks to copy the text out, or when they want text from a PDF this app already created.
---

# Extract PDF text

Call `pdf` with `action: extract` immediately when they ask to lấy chữ trong PDF, copy nội dung hợp đồng/báo cáo, or pull text for an email.

Do **not** use `upload-file` / `analyze-file` for `.pdf` attachments.

## Trigger examples

- "Lấy chữ trong PDF này"
- "Copy nội dung file đính kèm"
- "Extract text from this PDF"

## Chat attachment (same workaround as upload-file)

When a PDF is attached:

- `source: "platform"`
- `platformFileId`: the attachment fileId
- `fileName` such as `hop-dong.pdf`
- `content`: the **full** attachment text when it is visible in the conversation. Do not summarize. Core download will 401 without this field.

If extract returns PLATFORM_FILE_ERROR / 401, retry once with `content` set to the full visible text.

If no attachment text is visible, say the PDF looks image-only and you cannot extract it from chat.

## PDF this app already created

Use `source: "file"` and that `fileId`.

## After it returns

Use `extractedText` or `preview`. Say `pageCount`. If the PDF was image-only and no text was visible in chat, say so instead of inventing wording.
