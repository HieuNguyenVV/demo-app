---
name: analyze-file
description: When the user attached a chat file or pasted file content and asks to read, analyze, summarize, or review it, automatically upload to the app server then analyze it.
---

# Read and analyze user files

Use this workflow whenever the user wants to read or analyze a file they provided.

The user does **not** need to say "upload". If they attached a file and ask to read, analyze, summarize, review, or explain it — even briefly — run the full workflow immediately.

## Trigger examples (call tools without asking)

Chat attachment plus any of these (Vietnamese or English):

- "Phân tích file này"
- "Đọc và phân tích"
- "Xem file đính kèm"
- "Tóm tắt giúp tôi"
- "Analyze this file"
- "Read the attachment"
- "What does this file say?"

Also trigger when the user attaches a file and their message clearly refers to that attachment, even with no extra words.

## Chat attachment flow (always 2 steps)

When a chat attachment is present:

1. Call `upload-file` immediately with:
   - `source: "platform"`
   - `platformFileId`: the attachment `fileId` from the chat message
   - `fileName`: the attachment name, for example `todo.txt`
   - `content`: the **full** attachment text when it is visible in the conversation (do not summarize). The app backend cannot download chat files from Core with an invocation JWT; Core `/api/files/{id}/download` requires a browser user session.
2. Call `analyze-file` with the app `fileId` returned from step 1.

Do not skip step 1. Do not try to analyze the attachment without uploading it to the app server first.
If `upload-file` returns PLATFORM_FILE_ERROR / 401, retry once with `content` set to the full attachment text.

## Pasted text flow

When the user pasted the full file body (no chat attachment):

1. Call `upload-file` with `source: "content"`, `fileName`, and `content`.
2. Call `analyze-file` with the returned app `fileId`.

## After analyze-file returns

Report `summary`, `wordCount`, `sentenceCount`, and `readingMinutes`.
Do not paste the full `preview` unless the user explicitly asks for it.

## Do not use this workflow for

- Bundled demo files inside the app → use `analyze-text` with `source: "file"` and `sample-article.txt` or `sample-notes.txt`.
- Quick exact counts on inline pasted text only → use `count-words`.
- Creating export files → use `generate-file`.

When a chat attachment exists, never use `analyze-text` instead of this workflow.
