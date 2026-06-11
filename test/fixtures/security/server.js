const http = require('http');
const fs = require('fs');
const path = require('path');

const FIXTURES = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures.json'), 'utf-8'));
const DEFAULT_BODY = '<!DOCTYPE html><html><body>Security fixture</body></html>';

function createServer(port) {
  const server = http.createServer((req, res) => {
    const match = req.url.match(/^\/fixture\/([\w-]+)/);
    if (!match) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const id = match[1];
    const fixture = FIXTURES.find(f => f.id === id);
    if (!fixture) {
      res.writeHead(404);
      res.end('Unknown fixture: ' + id);
      return;
    }

    const headers = { 'Content-Type': 'text/html', ...fixture.headers };
    const body = fixture.body || DEFAULT_BODY;
    res.writeHead(200, headers);
    res.end(body);
  });

  return new Promise((resolve, reject) => {
    server.listen(port || 0, () => {
      const addr = server.address();
      resolve({ port: addr.port, close: () => server.close() });
    });
    server.on('error', reject);
  });
}

module.exports = { createServer, FIXTURES };
