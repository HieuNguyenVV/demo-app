---
name: pdf-edit
description: Use when an office worker attaches a PDF in chat and asks to stamp, add a cover, add notes, or otherwise edit it — or when they want to edit a PDF this app already created.
---

# Edit office PDF

Call `pdf` with `action: edit` immediately when they ask to đóng dấu (BẢN SAO, MẬT, CONFIDENTIAL), thêm trang bìa, ghi chú cuối file, tách trang, or sửa PDF.

The user does **not** need to say "upload". If they attached a `.pdf` and asked to edit it, call `pdf` now. Do **not** use `upload-file` / `analyze-file` for PDFs.

## Trigger examples

- "Sửa file này"
- "Đóng dấu MẬT vào PDF đính kèm"
- "Thêm trang bìa"
- "Stamp COPY on this PDF"
- "Edit the attached PDF"

## Chat attachment (same workaround as upload-file)

When a PDF is attached in chat, call immediately with:

- `source: "platform"`
- `platformFileId`: the chat attachment fileId
- `fileName`: ascii name such as `hop-dong.pdf` (letters, numbers, `.`, `_`, `-` only)
- `content`: the **full** attachment text when it is visible in the conversation (do not summarize). The app cannot download chat PDFs from Core with an invocation JWT.
- `editMode`: `stamp`, `cover-page`, or `append-page` (`page-range` is not available for chat attachments)
- For `stamp`, set `text` to the mark (MẬT, BẢN SAO, COPY). If they did not specify a mark, use `BẢN SAO`.

If the tool says to retry with `content`, call again with the full visible text.

If the host shows **no** readable PDF text (scanned/image PDF), say you cannot stamp the original bytes from chat and ask them to paste the wording they want on the new pages — do not invent contract text.

## PDF this app already created

Use `source: "file"` and that `fileId`. Do not use `source: platform` for Inkline-generated files.

`page-range` only works with `source: file` + `fileId` or original PDF bytes.
