import { drawFlowchartSvg, parseDiagramPrompt, wrapSvgAsDrawio } from './openai-diagram.js';
import { UpstreamToolError } from './tool.shared.js';

const MIME_TYPE = 'application/vnd.jgraph.mxfile';

export type GenerateDrawioResult = {
  fileName: string;
  format: 'drawio';
  mimeType: string;
  contentEncoding: 'text';
  sizeBytes: number;
  nodeCount: number;
  edgeCount: number;
  summary: string;
  content: string;
  previewSvg: string;
  _sota: {
    modelProjection: {
      omitKeys: ['content', 'previewSvg'];
    };
  };
};

export async function handleGenerateDrawio(input: unknown): Promise<GenerateDrawioResult> {
  const request = parseDiagramPrompt(input);
  try {
    const drawn = await drawWithRepair(request.prompt);
    const content = wrapSvgAsDrawio(drawn.svg, request.title || drawn.title);
    const fileName = `${request.baseName}.drawio`;
    return {
      fileName,
      format: 'drawio',
      mimeType: MIME_TYPE,
      contentEncoding: 'text',
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      nodeCount: drawn.nodeCount,
      edgeCount: drawn.edgeCount,
      summary: `OpenAI drew ${fileName} (${drawn.nodeCount} shapes). Download and open in diagrams.net.`,
      content,
      previewSvg: drawn.svg,
      _sota: {
        modelProjection: {
          omitKeys: ['content', 'previewSvg'],
        },
      },
    };
  } catch (error) {
    throw wrapOpenAiError(error);
  }
}

async function drawWithRepair(prompt: string) {
  try {
    return await drawFlowchartSvg(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('OPENAI_API_KEY') || message.includes('Timeout') || message.includes('aborted')) {
      throw error;
    }
    return await drawFlowchartSvg(prompt, message.slice(0, 240));
  }
}

function wrapOpenAiError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'OpenAI diagram failed';
  if (message.includes('OPENAI_API_KEY')) {
    throw new UpstreamToolError('Diagram drawing is not configured. Set OPENAI_API_KEY on the app backend.');
  }
  if (/timeout|aborted/i.test(message)) {
    throw new UpstreamToolError('OpenAI diagram timed out. Try a shorter prompt.');
  }
  throw new UpstreamToolError(`OpenAI could not draw the diagram: ${message.slice(0, 160)}`);
}
