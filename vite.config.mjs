import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createOpenAIResponse } from './api/openai.js';

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function localOpenAIProxy() {
  return {
    name: 'local-openai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/openai', async (req, res, next) => {
        if (!req.url?.startsWith('/api/openai')) {
          next();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Only POST allowed' }));
          return;
        }

        try {
          const body = await readJsonBody(req);
          const payload = await createOpenAIResponse({
            model: body.model,
            messages: body.messages,
            apiKey: process.env.OPENAI_API_KEY,
          });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error?.message || 'Server error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (!process.env.OPENAI_API_KEY && env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  }
  if (!process.env.OPENAI_MODEL && env.OPENAI_MODEL) {
    process.env.OPENAI_MODEL = env.OPENAI_MODEL;
  }

  return {
    plugins: [react(), localOpenAIProxy()],
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      globals: true,
    },
  };
});
