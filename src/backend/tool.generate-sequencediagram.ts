import { drawSequenceSvg, parseDiagramPrompt, wrapSvgAsDrawio } from './openai-diagram.js';
import { UpstreamToolError } from './tool.shared.js';

const DRAWIO_MIME = 'application/vnd.jgraph.mxfile';
const TXT_MIME = 'text/plain';

export type GenerateSequenceDiagramResult = {
  fileName: string;
  format: 'drawio';
  mimeType: string;
  contentEncoding: 'text';
  sizeBytes: number;
  txtFileName: string;
  txtMimeType: string;
  txtSizeBytes: number;
  participantCount: number;
  messageCount: number;
  summary: string;
  content: string;
  txtContent: string;
  previewSvg: string;
  _sota: {
    modelProjection: {
      omitKeys: ['content', 'txtContent', 'previewSvg'];
    };
  };
};

export async function handleGenerateSequenceDiagram(input: unknown): Promise<GenerateSequenceDiagramResult> {
  const request = parseDiagramPrompt(input);
  try {
    const drawn = await drawWithRepair(request.prompt);
    const content = wrapSvgAsDrawio(drawn.svg, request.title || drawn.title);
    const fileName = `${request.baseName}.drawio`;
    const txtFileName = `${request.baseName}.txt`;
    return {
      fileName,
      format: 'drawio',
      mimeType: DRAWIO_MIME,
      contentEncoding: 'text',
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      txtFileName,
      txtMimeType: TXT_MIME,
      txtSizeBytes: Buffer.byteLength(drawn.sequenceText, 'utf8'),
      participantCount: drawn.participantCount,
      messageCount: drawn.messageCount,
      summary: `OpenAI drew ${fileName} and ${txtFileName} (${drawn.participantCount} lifelines, ${drawn.messageCount} messages). Open the .drawio in diagrams.net; paste the .txt into sequencediagram.org to edit.`,
      content,
      txtContent: drawn.sequenceText,
      previewSvg: drawn.svg,
      _sota: {
        modelProjection: {
          omitKeys: ['content', 'txtContent', 'previewSvg'],
        },
      },
    };
  } catch (error) {
    throw wrapOpenAiError(error);
  }
}

async function drawWithRepair(prompt: string) {
  try {
    return await drawSequenceSvg(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('OPENAI_API_KEY') || message.includes('Timeout') || message.includes('aborted')) {
      throw error;
    }
    return await drawSequenceSvg(prompt, message.slice(0, 240));
  }
}

function wrapOpenAiError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'OpenAI sequence failed';
  if (message.includes('OPENAI_API_KEY')) {
    throw new UpstreamToolError('Diagram drawing is not configured. Set OPENAI_API_KEY on the app backend.');
  }
  if (/timeout|aborted/i.test(message)) {
    throw new UpstreamToolError('OpenAI diagram timed out. Try a shorter prompt.');
  }
  throw new UpstreamToolError(`OpenAI could not draw the sequence: ${message.slice(0, 160)}`);
}
