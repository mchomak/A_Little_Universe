// Temporary local receiver for canvas screenshots captured from the existing viewer.
// Start with `node screenshot_receiver.cjs`, capture, then stop this process.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.resolve(__dirname, '..', 'screenshots');
const port = Number(process.env.LILY_QA_SCREENSHOT_PORT || 5193);
fs.mkdirSync(outputDir, { recursive: true });

const server = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5192');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  if (request.method === 'POST' && request.url === '/shutdown') {
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('stopping');
    server.close(() => process.exit(0));
    return;
  }
  const match = request.url?.match(/^\/capture\/([a-z0-9-]+)$/);
  if (request.method !== 'POST' || !match) {
    response.writeHead(404).end();
    return;
  }
  const name = match[1];
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    try {
      const base64 = Buffer.concat(chunks).toString('utf8');
      const png = Buffer.from(base64, 'base64');
      if (png.length < 1000 || png[0] !== 0x89 || png[1] !== 0x50) throw new Error('Invalid PNG');
      const destination = path.join(outputDir, `${name}.png`);
      fs.writeFileSync(destination, png);
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name, bytes: png.length }));
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'text/plain' }).end(String(error));
    }
  });
});

server.listen(port, '127.0.0.1', () => console.log(`Lily QA screenshot receiver listening at 127.0.0.1:${port}`));
