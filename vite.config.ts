import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'photo-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/photo-proxy')) {
            try {
              const urlObj = new URL(req.url, 'http://localhost');
              const targetUrl = urlObj.searchParams.get('url');
              if (!targetUrl) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'URL query parameter is required' }));
                return;
              }

              const response = await fetch(targetUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              });

              if (!response.ok) {
                res.statusCode = response.status;
                res.end(JSON.stringify({ error: `Fetch failed with status ${response.status}` }));
                return;
              }

              const html = await response.text();
              res.setHeader('Content-Type', 'text/html');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(html);
            } catch (err) {
              res.statusCode = 500;
              const errorMessage = err instanceof Error ? err.message : String(err);
              res.end(JSON.stringify({ error: errorMessage }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
})

