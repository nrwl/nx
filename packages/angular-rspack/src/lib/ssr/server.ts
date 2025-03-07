import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';

interface RspackAngularServer {
  app: express.Express;
  listen: (port?: number) => void;
}

export interface RspackAngularServerOptions {
  serverDistFolder?: string;
  browserDistFolder?: string;
  indexHtml?: string;
}

export function createServer(
  bootstrap: any,
  opts?: RspackAngularServerOptions
): RspackAngularServer {
  const serverDistFolder = opts?.serverDistFolder ?? dirname(__filename);
  const browserDistFolder =
    opts?.browserDistFolder ?? resolve(serverDistFolder, '../browser');
  const indexHtml = opts?.indexHtml ?? join(browserDistFolder, 'index.html');

  const app = express();
  const commonEngine = new CommonEngine();

  app.get(
    '**',
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
    })
  );

  /**
   * Handle all other requests by rendering the Angular application.
   */
  app.get('**', async (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => {
        res.send(html);
      })
      .catch((err) => next(err));
  });

  return {
    app,
    listen: (
      port: number = process.env['PORT']
        ? Number.parseInt(process.env['PORT'], 10)
        : 4000
    ) => {
      app.listen(port, () => {
        console.log(
          `Node Express server listening on http://localhost:${port}`
        );
      });
    },
  };
}
