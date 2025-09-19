import http from 'node:http';

const server = http.createServer((req, res) => {
  const name = req.url?.split('/api/')[1] || 'stranger';

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({ message: `Hello ${name}!` }));
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
