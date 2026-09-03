import type { Express } from 'express';
import express from 'express';
import { FileNotFoundError } from './file-store.js';
import { handleAnalyzeFile } from './tool.analyze-file.js';
import { handleAnalyzeText } from './tool.analyze-text.js';
import { handleCountWords } from './tool.count-words.js';
import { handleGenerateDrawio } from './tool.generate-drawio.js';
import { handleGenerateFile } from './tool.generate-file.js';
import { handleMeetingMinutes } from './tool.meeting-minutes.js';
import { handleUploadFile, PlatformFileError } from './tool.upload-file.js';
import { InvalidToolInputError, isRecord } from './tool.shared.js';
import type { InvocationClaims } from './sota-auth.js';
import { requireSotaInvocation } from './sota-auth.js';

export function registerToolRoutes(app: Express, appId: string) {
  app.post('/tools/count-words', requireSotaInvocation(appId, 'tool:count-words'), async (request, response) => {
    await respondWithTool(request, response, (input) => handleCountWords(input));
  });

  app.post('/tools/analyze-text', requireSotaInvocation(appId, 'tool:analyze-text'), async (request, response) => {
    await respondWithTool(request, response, (input) => handleAnalyzeText(input));
  });

  app.post('/tools/generate-file', requireSotaInvocation(appId, 'tool:generate-file'), async (request, response) => {
    await respondWithTool(request, response, (input) => handleGenerateFile(input));
  });

  app.post('/tools/generate-drawio', requireSotaInvocation(appId, 'tool:generate-drawio'), async (request, response) => {
    await respondWithTool(request, response, (input) => handleGenerateDrawio(input));
  });

  app.post('/tools/upload-file', requireSotaInvocation(appId, 'tool:upload-file'), async (request, response) => {
    await respondWithTool(request, response, (input, claims, token) =>
      handleUploadFile(input, claims, token, readCoreDelegationToken(request)),
    );
  });

  app.post('/tools/analyze-file', requireSotaInvocation(appId, 'tool:analyze-file'), async (request, response) => {
    await respondWithTool(request, response, (input, claims) => handleAnalyzeFile(input, claims));
  });

  app.post('/tools/meeting-minutes', requireSotaInvocation(appId, 'tool:meeting-minutes'), async (request, response) => {
    await respondWithTool(request, response, (input, claims) => handleMeetingMinutes(input, claims));
  });
}

async function respondWithTool(
  request: express.Request,
  response: express.Response,
  handler: (input: unknown, claims: InvocationClaims, token: string) => unknown | Promise<unknown>,
) {
  const token = readBearerToken(request);
  if (!token) {
    response.status(401).json({ code: 'AUTH_ERROR', message: 'Missing invocation token' });
    return;
  }

  const body = isRecord(request.body?.body) ? request.body.body : request.body;
  try {
    response.json(await handler(body?.input ?? body, response.locals.sota, token));
  } catch (error) {
    if (error instanceof InvalidToolInputError) {
      response.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    if (error instanceof FileNotFoundError) {
      response.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    if (error instanceof PlatformFileError) {
      response.status(error.status).json({ code: error.code, message: error.message });
      return;
    }
    throw error;
  }
}

function readBearerToken(request: express.Request): string | undefined {
  return /^Bearer\s+(.+)$/i.exec(request.header('authorization') ?? '')?.[1];
}

function readCoreDelegationToken(request: express.Request): string | undefined {
  const value = request.header('x-sota-core-token')?.trim();
  return value && value.length > 0 ? value : undefined;
}
