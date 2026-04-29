const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./server');

// Load .env.local if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const port = Number(process.env.PORT || 3000);

const server = createServer();

server.listen(port, '0.0.0.0', () => {
  console.log(`Digital Wardrobe API listening on http://127.0.0.1:${port} [${process.env.NODE_ENV || 'development'}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => server.gracefulShutdown());
process.on('SIGINT', () => server.gracefulShutdown());
