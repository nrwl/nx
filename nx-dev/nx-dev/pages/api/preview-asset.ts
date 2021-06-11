import type { NextApiRequest, NextApiResponse } from 'next';
import { join } from 'path';

import * as send from 'send';

// Repeated here since `data-access-documents` isn't available at runtime.
const previewRootPath = join(process.env.WORKSPACE_ROOT, 'docs');

export default function (req: NextApiRequest, res: NextApiResponse) {
  return new Promise<void>((resolve) => {
    if (Array.isArray(req.query.uri) || Array.isArray(req.query.document)) {
      res.writeHead(422, { 'Content-Type': 'text/plain' });
      res.end('Invalid URI');
    } else {
      const uri = decodeURIComponent(req.query.uri);
      const document = decodeURIComponent(req.query.document);
      const src = uri.startsWith('.') ? join(document, '..', uri) : uri;
      const stream = send(req, src, {
        // Files outside of the root are forbidden and will result in 404.
        root: previewRootPath,
      });

      stream.on('end', () => {
        resolve();
      });

      stream.on('error', (err) => {
        res.status(404);
        res.write(`Not Found ${err.message}`);
        res.end();
        resolve();
      });

      stream.pipe(res);
    }
  });
}
