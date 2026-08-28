import type { Express } from 'express';
import { handleCountWords } from './tool.count-words.js';
import { InvalidToolInputError } from './tool.shared.js';

export function registerTestRoutes(app: Express, appId: string) {
  app.get('/api/test', (_request, response) => {
    response.json({
      status: 'ok',
      appId,
      auth: false,
      sample: handleCountWords({ text: 'hello from docker' }),
    });
  });

  app.post('/api/test', (request, response) => {
    try {
      response.json({
        status: 'ok',
        appId,
        result: handleCountWords(request.body),
      });
    } catch (error) {
      if (error instanceof InvalidToolInputError) {
        response.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      throw error;
    }
  });
}
