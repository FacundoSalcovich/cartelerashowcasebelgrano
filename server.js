import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCartelera } from './api/cartelera.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3001;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Development Server-Sent Events (SSE) clients for hot reload
const devClients = new Set();
let devWatchDebounce = null;

try {
  fs.watch(PUBLIC_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const ext = path.extname(filename).toLowerCase();
    if (!['.css', '.js', '.html'].includes(ext)) return;

    clearTimeout(devWatchDebounce);
    devWatchDebounce = setTimeout(() => {
      const isCss = ext === '.css';
      const payload = JSON.stringify({ type: isCss ? 'css' : 'reload', file: filename });
      for (const client of devClients) {
        try {
          client.write(`data: ${payload}\n\n`);
        } catch (e) {
          devClients.delete(client);
        }
      }
    }, 60);
  });
} catch (watchErr) {
  console.warn('Dev watch notice:', watchErr.message);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Development live-reload SSE endpoint
  if (pathname === '/api/dev-reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: {"type":"connected"}\n\n');
    devClients.add(res);

    req.on('close', () => {
      devClients.delete(res);
    });
    return;
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // Local mock for Vercel edge endpoints (Analytics / Insights)
  if (pathname.startsWith('/_vercel/')) {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    return res.end('/* Local Vercel Edge Script Mock */');
  }

  // API Route
  if (pathname === '/api/cartelera' || pathname === '/api/cartelera.js') {
    try {
      const dateParam = parsedUrl.searchParams.get('date');
      const cinemaParam = parsedUrl.searchParams.get('cinema') || parsedUrl.searchParams.get('cinemaId') || '14';
      const data = await getCartelera(dateParam, cinemaParam);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Static files
  let safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(PUBLIC_DIR, safePath);

  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA feel
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFile, (errIndex, content) => {
        if (errIndex) {
          res.writeHead(404);
          return res.end('Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Internal Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🎬 Cartelera Showcase lista para usar:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`======================================================\n`);

  // Pre-warm default cartelera (Belgrano) cache on startup
  getCartelera().catch(e => console.warn('Pre-warm error:', e.message));
});
