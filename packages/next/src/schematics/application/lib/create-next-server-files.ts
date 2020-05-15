import { dirname, join } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import { NormalizedSchema } from './normalize-options';
import { appsDir } from '@nrwl/workspace/src/utils/ast-utils';

export function createNextServerFiles(options: NormalizedSchema) {
  return (host: Tree) => {
    if (options.server) {
      const directory = dirname(join(options.appProjectRoot, options.server));

      host.create(
        join(options.appProjectRoot, options.server),
        `
      // @ts-check
      'use strict';

      /**
       * @typedef {import('http').Server} Server
       * @typedef {import('next/dist/server/next-server').default} DevServer
       */

      const express = require('express');

      /**
       * @param {DevServer} app
       * @param {{dev: string; dir: string; staticMarkup: boolean; quiet: boolean; conf: any; port: number;}} options
       * @returns {Promise<Server>}
       */
      module.exports = async function nextServer(app, options) {
        const handle = app.getRequestHandler();
        const expressApp = express();

        await app.prepare();

        /**
         * @returns {Promise<Server>}
         */
        return new Promise((resolve, reject) => {

          expressApp.all('*', (req, res) => {
            return handle(req, res);
          });

          const server = expressApp.listen(options.port, (err) => {
            err ? reject(err) : resolve(server);
          });
        });
      }
      `
      );

      const apps = appsDir(host);

      host.create(
        join(directory, 'server.js'),
        `
      // @ts-check
      'use strict';

      /**
       * Production Nextjs custom server
       * 
       * Usage: run this script with node
       * Adjust dir option for your serve/deploy config
       * 
       * node server.js
       */

      /**
       * @typedef {import('next/dist/next-server/server/next-server').default} Server
       */

      const NextServer = require('next/dist/next-server/server/next-server').default;
      const express = require('express');

      const nextApp = new NextServer({
        dir: './dist/${apps}/<%= name %>',
        staticMarkup: false,
        quiet: false,
        conf: {
          distDir: '.'
        }
      });

      const serve = async () => {
        const handle = nextApp.getRequestHandler();
        const expressApp = express();

        await nextApp.prepare();

        return new Promise((resolve, reject) => {
          expressApp.all('*', (req, res) => {
            return handle(req, res);
          });

          const server = expressApp.listen(4200, err => {
            err ? reject(err) : resolve(server);
          });
        });
      }

      serve().then(server => console.log('Server is running on port 4200'));
      `
      );
    }
  };
}
