import type { Express } from 'express';

export function registerTestRoutes(app: Express, appId: string) {
  app.get('/api/test', (_request, response) => {
    response.json({
      status: 'ok',
      appId,
      auth: false,
    });
  });

  app.post('/api/test', (_request, response) => {
    response.json({
      status: 'ok',
      appId,
    });
  });
}
