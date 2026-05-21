//@ts-check

const http = require('http');

const inMemoryCache = {};
const socketIds = new WeakMap();
const cacheRequestSocketIds = [];
let nextSocketId = 0;

// IMPORTANT: This implementation serves only as a test fixture
// and is not intended for production use. It is a simple in-memory cache server.
// If one was to wish to use something like this in production, the following
// items should be considered:
// - Persistence: Use a database or a file system for storage
// - Security:
//    - Implement proper authentication and authorization
//    - Ensure existing data is not overwritten without checks
const server = http.createServer((req, res) => {
  const url = req.url;

  if (url === '/__stats') {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        cacheRequestSocketIds,
      })
    );
    return;
  }

  if (url === '/__reset-stats') {
    cacheRequestSocketIds.length = 0;
    res.statusCode = 204;
    res.end();
    return;
  }

  cacheRequestSocketIds.push(socketIds.get(req.socket));

  const parts = url?.split('/');
  const hash = parts?.[parts.length - 1];

  const auth = req.headers.authorization;
  if (auth !== 'Bearer test-token') {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'text/plain');
    res.end(
      'Unauthorized: Missing or invalid token. Set NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN to proceed.'
    );
    return;
  }

  if (req.method === 'GET') {
    console.log('Checking for hash:', hash);
    console.log('In memory cache:', !!inMemoryCache[hash]);
    if (inMemoryCache[hash]) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.end(inMemoryCache[hash]);
      return;
    }
    console.log('Not found:', hash);
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  if (req.method === 'PUT') {
    req.on('data', (chunk) => {
      if (!inMemoryCache[hash]) {
        inMemoryCache[hash] = new ArrayBuffer(); // initialize if not present
      }
      // Append the chunk to the existing buffer
      const newBuffer = Buffer.concat([
        Buffer.from(inMemoryCache[hash]),
        chunk,
      ]);
      inMemoryCache[hash] = newBuffer;
    });
    req.on('end', () => {
      console.log('Stored in memory cache:', hash);
      res.statusCode = 200;
      res.end('OK');
    });
    return;
  }
});

const PORT = Number(process.env.PORT ?? 3000);
server.on('connection', (socket) => {
  socketIds.set(socket, ++nextSocketId);
});
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
