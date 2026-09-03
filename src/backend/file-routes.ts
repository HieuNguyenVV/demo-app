import type { Express } from 'express';
import express from 'express';
import { handleUploadFile, PlatformFileError } from './tool.upload-file.js';
import { FileNotFoundError } from './file-store.js';
import { InvalidToolInputError } from './tool.shared.js';
import { requireSotaInvocation } from './sota-auth.js';

export function registerFileRoutes(app: Express, appId: string) {
  app.post('/api/files/upload', requireSotaInvocation(appId, 'app:http'), async (request, response) => {
    const token = readBearerToken(request);
    if (!token) {
      response.status(401).json({ code: 'AUTH_ERROR', message: 'Missing invocation token' });
      return;
    }

    try {
      response.json(await handleUploadFile(
        request.body,
        response.locals.sota,
        token,
        request.header('x-sota-core-token')?.trim() || undefined,
      ));
    } catch (error) {
      respondWithError(response, error);
    }
  });
}

function readBearerToken(request: express.Request): string | undefined {
  return /^Bearer\s+(.+)$/i.exec(request.header('authorization') ?? '')?.[1];
}

function respondWithError(response: express.Response, error: unknown) {
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
