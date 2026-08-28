import './styles.css';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppFetch, type ToolResultSurfaceProps } from '@sota/platform';

type CountWordsInput = {
  text: string;
};

type CountWordsOutput = {
  wordCount: number;
  characterCount: number;
  lineCount: number;
};

type AnalyzeTextInput = {
  source: 'text' | 'file';
  text?: string;
  fileName?: string;
  topWordsLimit?: number;
};

type AnalyzeTextOutput = {
  source: 'text' | 'file';
  fileName?: string;
  wordCount: number;
  characterCount: number;
  lineCount: number;
  sentenceCount: number;
  averageWordLength: number;
  readingMinutes: number;
  summary: string;
  topWords: Array<{ word: string; count: number }>;
};

type GenerateFileInput = {
  fileName: string;
  format: 'txt' | 'md' | 'json' | 'csv' | 'pdf';
  content: string;
  title?: string;
};

type GenerateFileOutput = {
  fileName: string;
  format: 'txt' | 'md' | 'json' | 'csv' | 'pdf';
  mimeType: string;
  contentEncoding: 'text' | 'base64';
  sizeBytes: number;
  lineCount: number;
  summary: string;
  content: string;
};

type UploadFileInput = {
  source: 'content' | 'platform';
  platformFileId?: string;
  fileName?: string;
  content?: string;
  mimeType?: string;
};

type UploadFileOutput = {
  source: 'content' | 'platform';
  fileId: string;
  platformFileId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  lineCount: number;
  summary: string;
};

type AnalyzeFileInput = {
  fileId: string;
  topWordsLimit?: number;
};

type AnalyzeFileOutput = {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  wordCount: number;
  characterCount: number;
  lineCount: number;
  sentenceCount: number;
  averageWordLength: number;
  readingMinutes: number;
  summary: string;
  preview: string;
  topWords: Array<{ word: string; count: number }>;
};

type MeetingMinutesInput = {
  source: 'text' | 'file';
  text?: string;
  fileId?: string;
  title?: string;
  meetingDate?: string;
};

type MeetingMinutesOutput = {
  source: 'text' | 'file';
  fileId?: string;
  fileName?: string;
  title: string;
  meetingDate: string;
  attendeeCount: number;
  decisionCount: number;
  actionItemCount: number;
  summary: string;
  attendees: string[];
  agenda: string[];
  discussionPoints: string[];
  decisions: string[];
  actionItems: Array<{ text: string; owner?: string; dueHint?: string }>;
  nextSteps: string[];
  formattedMinutes: string;
  docFileName: string;
  docMimeType: string;
  docContentEncoding: 'base64';
  docSizeBytes: number;
  docContent: string;
};

export function AdminScreen() {
  const appFetch = useAppFetch();
  const [message, setMessage] = useState('Connecting to backend…');
  useEffect(() => {
    appFetch('/api/hello')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((result) => setMessage(String(result.message)))
      .catch((error) => setMessage(`Backend error: ${String(error)}`));
  }, [appFetch]);
  return (
    <main className="starter-root starter-page" data-sota-app="my-app">
      <p className="starter-eyebrow">SotaAgent app</p>
      <h1>Admin screen</h1>
      <p className="starter-status">{message}</p>
      <p>Edit <code>src/ui/app.tsx</code>; Vite rebuilds into <code>dist/ui</code>.</p>
    </main>
  );
}

export function CountWordsResult({
  toolResult,
}: ToolResultSurfaceProps<CountWordsInput, CountWordsOutput>) {
  if (toolResult.state === 'input-streaming') {
    return (
      <ToolCard status="Reading text…" busy>
        <TextPreview value={partialText(toolResult.input)} />
      </ToolCard>
    );
  }

  if (
    toolResult.state === 'input-available' ||
    toolResult.state === 'output-pending' ||
    toolResult.state === 'approval-requested'
  ) {
    return (
      <ToolCard status="Counting…" busy>
        <TextPreview value={toolResult.input.text} />
      </ToolCard>
    );
  }

  if (toolResult.state === 'output-denied') {
    return <ToolCard status="Word count was not approved." />;
  }

  if (toolResult.state === 'output-error') {
    return <ToolCard status={toolResult.errorText ?? 'Could not count words.'} />;
  }

  if (toolResult.state !== 'output-available') return null;

  const result = toolResult.result;
  if (!result) return <ToolCard status="Could not count words." />;

  return (
    <ToolCard status="Word count">
      <dl className="count-stats">
        <div>
          <dt>Words</dt>
          <dd>{result.wordCount}</dd>
        </div>
        <div>
          <dt>Characters</dt>
          <dd>{result.characterCount}</dd>
        </div>
        <div>
          <dt>Lines</dt>
          <dd>{result.lineCount}</dd>
        </div>
      </dl>
    </ToolCard>
  );
}

export function AnalyzeTextResult({
  toolResult,
}: ToolResultSurfaceProps<AnalyzeTextInput, AnalyzeTextOutput>) {
  if (toolResult.state === 'input-streaming') {
    return (
      <ToolCard status="Preparing analysis…" busy>
        <AnalyzeInputPreview input={toolResult.input} />
      </ToolCard>
    );
  }

  if (
    toolResult.state === 'input-available' ||
    toolResult.state === 'output-pending' ||
    toolResult.state === 'approval-requested'
  ) {
    return (
      <ToolCard status="Analyzing text…" busy>
        <AnalyzeInputPreview input={toolResult.input} />
      </ToolCard>
    );
  }

  if (toolResult.state === 'output-denied') {
    return <ToolCard status="Text analysis was not approved." />;
  }

  if (toolResult.state === 'output-error') {
    return <ToolCard status={toolResult.errorText ?? 'Could not analyze text.'} />;
  }

  if (toolResult.state !== 'output-available') return null;

  const result = toolResult.result;
  if (!result) return <ToolCard status="Could not analyze text." />;

  const maxCount = result.topWords[0]?.count ?? 1;

  return (
    <ToolCard status="Text analysis">
      <div className="analyze-header">
        <span className="analyze-badge">{result.source === 'file' ? 'Sample file' : 'Inline text'}</span>
        {result.fileName ? <span className="analyze-file">{result.fileName}</span> : null}
      </div>
      <p className="analyze-summary">{result.summary}</p>
      <dl className="analyze-stats">
        <div><dt>Words</dt><dd>{result.wordCount}</dd></div>
        <div><dt>Sentences</dt><dd>{result.sentenceCount}</dd></div>
        <div><dt>Read time</dt><dd>{result.readingMinutes} min</dd></div>
        <div><dt>Avg length</dt><dd>{result.averageWordLength}</dd></div>
        <div><dt>Characters</dt><dd>{result.characterCount}</dd></div>
        <div><dt>Lines</dt><dd>{result.lineCount}</dd></div>
      </dl>
      {result.topWords.length > 0 ? (
        <div className="analyze-keywords">
          <p className="analyze-keywords-title">Top keywords</p>
          <ul>
            {result.topWords.map((item) => (
              <li key={item.word}>
                <span className="analyze-keyword-label">{item.word}</span>
                <span className="analyze-keyword-bar" style={{ width: `${Math.max(12, (item.count / maxCount) * 100)}%` }} />
                <span className="analyze-keyword-count">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ToolCard>
  );
}

export function GenerateFileResult({
  toolResult,
}: ToolResultSurfaceProps<GenerateFileInput, GenerateFileOutput>) {
  if (toolResult.state === 'input-streaming') {
    return (
      <ToolCard status="Preparing file…" busy>
        <GenerateInputPreview input={toolResult.input} />
      </ToolCard>
    );
  }

  if (
    toolResult.state === 'input-available' ||
    toolResult.state === 'output-pending' ||
    toolResult.state === 'approval-requested'
  ) {
    return (
      <ToolCard status="Generating file…" busy>
        <GenerateInputPreview input={toolResult.input} />
      </ToolCard>
    );
  }

  if (toolResult.state === 'output-denied') {
    return <ToolCard status="File generation was not approved." />;
  }

  if (toolResult.state === 'output-error') {
    return <ToolCard status={toolResult.errorText ?? 'Could not generate file.'} />;
  }

  if (toolResult.state !== 'output-available') return null;

  const result = toolResult.result;
  if (!result) return <ToolCard status="Could not generate file." />;

  return (
    <ToolCard status="Generated file">
      <div className="generate-header">
        <span className="analyze-badge">{result.format.toUpperCase()}</span>
        <span className="analyze-file">{result.fileName}</span>
      </div>
      <p className="analyze-summary">{result.summary}</p>
      <dl className="generate-meta">
        <div><dt>Size</dt><dd>{formatBytes(result.sizeBytes)}</dd></div>
        <div><dt>Lines</dt><dd>{result.lineCount}</dd></div>
      </dl>
      <pre className="generate-preview">{previewFileContent(result)}</pre>
      <DownloadLink
        fileName={result.fileName}
        content={result.content}
        contentEncoding={result.contentEncoding}
        mimeType={result.mimeType}
      />
    </ToolCard>
  );
}

export function UploadFileResult({
  toolResult,
}: ToolResultSurfaceProps<UploadFileInput, UploadFileOutput>) {
  if (toolResult.state === 'input-streaming' || toolResult.state === 'input-available' || toolResult.state === 'output-pending' || toolResult.state === 'approval-requested') {
    return (
      <ToolCard status={toolResult.state === 'input-streaming' ? 'Preparing upload…' : 'Uploading file…'} busy>
        <UploadInputPreview input={toolResult.state === 'input-streaming' ? toolResult.input : toolResult.input} />
      </ToolCard>
    );
  }

  if (toolResult.state === 'output-denied') {
    return <ToolCard status="Upload was not approved." />;
  }

  if (toolResult.state === 'output-error') {
    return <ToolCard status={toolResult.errorText ?? 'Could not upload file.'} />;
  }

  if (toolResult.state !== 'output-available') return null;

  const result = toolResult.result;
  if (!result) return <ToolCard status="Could not upload file." />;

  return (
    <ToolCard status="Uploaded file">
      <div className="generate-header">
        <span className="analyze-badge">Stored</span>
        <span className="analyze-file">{result.fileName}</span>
      </div>
      <p className="analyze-summary">{result.summary}</p>
      <dl className="generate-meta">
        <div><dt>File ID</dt><dd className="file-id">{result.fileId}</dd></div>
        <div><dt>Size</dt><dd>{formatBytes(result.sizeBytes)}</dd></div>
      </dl>
    </ToolCard>
  );
}

export function AnalyzeFileResult({
  toolResult,
}: ToolResultSurfaceProps<AnalyzeFileInput, AnalyzeFileOutput>) {
  if (toolResult.state === 'input-streaming' || toolResult.state === 'input-available' || toolResult.state === 'output-pending' || toolResult.state === 'approval-requested') {
    return (
      <ToolCard status={toolResult.state === 'input-streaming' ? 'Preparing analysis…' : 'Analyzing uploaded file…'} busy>
        <AnalyzeFileInputPreview input={toolResult.state === 'input-streaming' ? toolResult.input : toolResult.input} />
      </ToolCard>
    );
  }

  if (toolResult.state === 'output-denied') {
    return <ToolCard status="File analysis was not approved." />;
  }

  if (toolResult.state === 'output-error') {
    return <ToolCard status={toolResult.errorText ?? 'Could not analyze uploaded file.'} />;
  }

  if (toolResult.state !== 'output-available') return null;

  const result = toolResult.result;
  if (!result) return <ToolCard status="Could not analyze uploaded file." />;

  const maxCount = result.topWords[0]?.count ?? 1;

  return (
    <ToolCard status="File analysis">
      <div className="analyze-header">
        <span className="analyze-badge">Uploaded</span>
        <span className="analyze-file">{result.fileName}</span>
      </div>
      <p className="analyze-summary">{result.summary}</p>
      <dl className="analyze-stats">
        <div><dt>Words</dt><dd>{result.wordCount}</dd></div>
        <div><dt>Sentences</dt><dd>{result.sentenceCount}</dd></div>
        <div><dt>Read time</dt><dd>{result.readingMinutes} min</dd></div>
        <div><dt>Avg length</dt><dd>{result.averageWordLength}</dd></div>
        <div><dt>Characters</dt><dd>{result.characterCount}</dd></div>
        <div><dt>Lines</dt><dd>{result.lineCount}</dd></div>
      </dl>
      <pre className="generate-preview">{result.preview}</pre>
      {result.topWords.length > 0 ? (
        <div className="analyze-keywords">
          <p className="analyze-keywords-title">Top keywords</p>
          <ul>
            {result.topWords.map((item) => (
              <li key={item.word}>
                <span className="analyze-keyword-label">{item.word}</span>
                <span className="analyze-keyword-bar" style={{ width: `${Math.max(12, (item.count / maxCount) * 100)}%` }} />
                <span className="analyze-keyword-count">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ToolCard>
  );
}

export function MeetingMinutesResult({
  toolResult,
}: ToolResultSurfaceProps<MeetingMinutesInput, MeetingMinutesOutput>) {
  if (toolResult.state === 'input-streaming') {
    return (
      <ToolCard status="Reading notes…" busy>
        <MeetingMinutesInputPreview input={toolResult.input} />
      </ToolCard>
    );
  }

  if (
    toolResult.state === 'input-available' ||
    toolResult.state === 'output-pending' ||
    toolResult.state === 'approval-requested'
  ) {
    return (
      <ToolCard status="Formatting minutes…" busy>
        <MeetingMinutesInputPreview input={toolResult.input} />
      </ToolCard>
    );
  }

  if (toolResult.state === 'output-denied') {
    return <ToolCard status="Meeting minutes were not approved." />;
  }

  if (toolResult.state === 'output-error') {
    return <ToolCard status={toolResult.errorText ?? 'Could not format meeting minutes.'} />;
  }

  if (toolResult.state !== 'output-available') return null;

  const result = toolResult.result;
  if (!result) return <ToolCard status="Could not format meeting minutes." />;

  return (
    <ToolCard status="Meeting minutes">
      <div className="analyze-header">
        <span className="analyze-badge">Office</span>
        <span className="analyze-file">{result.title}</span>
      </div>
      <p className="analyze-summary">{result.summary}</p>
      <dl className="analyze-stats">
        <div><dt>Date</dt><dd>{result.meetingDate}</dd></div>
        <div><dt>Attendees</dt><dd>{result.attendeeCount}</dd></div>
        <div><dt>Actions</dt><dd>{result.actionItemCount}</dd></div>
      </dl>
      {result.decisions.length > 0 ? (
        <MinutesSection title="Decisions" items={result.decisions} />
      ) : null}
      {result.actionItems.length > 0 ? (
        <div className="minutes-section">
          <p className="minutes-section-title">Action items</p>
          <ul className="minutes-list">
            {result.actionItems.map((item, index) => (
              <li key={`${item.text}-${index}`}>
                <span>{item.text}</span>
                {item.owner ? <span className="minutes-meta">@{item.owner}</span> : null}
                {item.dueHint ? <span className="minutes-meta">due {item.dueHint}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <pre className="generate-preview">{result.formattedMinutes}</pre>
      <DownloadLink
        fileName={result.docFileName}
        content={result.docContent}
        contentEncoding={result.docContentEncoding}
        mimeType={result.docMimeType}
      />
    </ToolCard>
  );
}

function MinutesSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="minutes-section">
      <p className="minutes-section-title">{title}</p>
      <ul className="minutes-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ToolCard({
  status,
  busy = false,
  children,
}: {
  status: string;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="starter-root starter-result" data-sota-app="my-app" aria-busy={busy || undefined}>
      <strong>{status}</strong>
      {children}
    </section>
  );
}

function TextPreview({ value }: { value?: string }) {
  if (!value) return <p className="count-preview">Waiting for the model…</p>;
  return <p className="count-preview">{value.length > 160 ? `${value.slice(0, 160)}…` : value}</p>;
}

function AnalyzeInputPreview({ input }: { input?: unknown }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return <p className="count-preview">Waiting for the model…</p>;
  }
  const record = input as Record<string, unknown>;
  if (record.source === 'file' && typeof record.fileName === 'string') {
    return <p className="count-preview">File: {record.fileName}</p>;
  }
  if (typeof record.text === 'string') {
    return <TextPreview value={record.text} />;
  }
  return <p className="count-preview">Waiting for analysis input…</p>;
}

function GenerateInputPreview({ input }: { input?: unknown }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return <p className="count-preview">Waiting for the model…</p>;
  }
  const record = input as Record<string, unknown>;
  const fileName = typeof record.fileName === 'string' ? record.fileName : 'file';
  const format = typeof record.format === 'string' ? record.format : 'txt';
  return <p className="count-preview">{fileName}.{format}</p>;
}

function UploadInputPreview({ input }: { input?: unknown }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return <p className="count-preview">Waiting for the model…</p>;
  }
  const record = input as Record<string, unknown>;
  if (record.source === 'platform') {
    const fileName = typeof record.fileName === 'string' ? record.fileName : 'attachment';
    const platformFileId = typeof record.platformFileId === 'string' ? record.platformFileId : undefined;
    return (
      <p className="count-preview">
        {fileName}
        {platformFileId ? ` · ${platformFileId}` : ''}
      </p>
    );
  }
  const fileName = typeof record.fileName === 'string' ? record.fileName : 'file';
  const content = typeof record.content === 'string' ? record.content : '';
  return (
    <>
      <p className="count-preview">{fileName}</p>
      {content ? <p className="count-preview">{content.length > 160 ? `${content.slice(0, 160)}…` : content}</p> : null}
    </>
  );
}

function AnalyzeFileInputPreview({ input }: { input?: unknown }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return <p className="count-preview">Waiting for the model…</p>;
  }
  const fileId = (input as Record<string, unknown>).fileId;
  return <p className="count-preview">{typeof fileId === 'string' ? `File ID: ${fileId}` : 'Waiting for file ID…'}</p>;
}

function MeetingMinutesInputPreview({ input }: { input?: unknown }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return <p className="count-preview">Waiting for the model…</p>;
  }
  const record = input as Record<string, unknown>;
  if (record.source === 'file' && typeof record.fileId === 'string') {
    return <p className="count-preview">File ID: {record.fileId}</p>;
  }
  if (typeof record.title === 'string') {
    return <p className="count-preview">{record.title}</p>;
  }
  if (typeof record.text === 'string') {
    return <p className="count-preview">{record.text.length > 160 ? `${record.text.slice(0, 160)}…` : record.text}</p>;
  }
  return <p className="count-preview">Waiting for the model…</p>;
}

function DownloadLink({
  fileName,
  content,
  contentEncoding,
  mimeType,
}: {
  fileName: string;
  content: string;
  contentEncoding: 'text' | 'base64';
  mimeType: string;
}) {
  const href = useMemo(() => {
    const bytes = contentEncoding === 'base64'
      ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
      : content;
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  }, [content, contentEncoding, mimeType]);
  useEffect(() => () => URL.revokeObjectURL(href), [href]);
  return (
    <a className="generate-download" download={fileName} href={href}>
      Download {fileName}
    </a>
  );
}

function previewFileContent(result: GenerateFileOutput): string {
  if (result.format === 'pdf') {
    return 'PDF document ready to download.';
  }
  return result.content.length > 480 ? `${result.content.slice(0, 480)}…` : result.content;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function partialText(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const text = (input as Record<string, unknown>).text;
  return typeof text === 'string' ? text : undefined;
}

export const surfaces = {
  AdminScreen,
  CountWordsResult,
  AnalyzeTextResult,
  GenerateFileResult,
  UploadFileResult,
  AnalyzeFileResult,
  MeetingMinutesResult,
};
