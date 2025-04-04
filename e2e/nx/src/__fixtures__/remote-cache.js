//@ts-check

const http = require('http');

const inMemoryCache = {};

const server = http.createServer((req, res) => {
  const url = req.url;
  const parts = url?.split('/');
  const hash = parts?.[parts.length - 1];

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

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
