/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as net from 'net';

export function checkPort(port: number, host: string, basePort = 49152): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    function _getPort(portNumber: number) {
      if (portNumber > 65535) {
        reject(new Error(`There is no port available.`));
      }

      const server = net.createServer();

      server.once('error', (err: Error & {code: string}) => {
        if (err.code !== 'EADDRINUSE') {
          reject(err);
        } else if (port === 0) {
          _getPort(portNumber + 1);
        } else {
          // If the port isn't available and we weren't looking for any port, throw error.
          reject(
            new Error(`Port ${port} is already in use. Use '--port' to specify a different port.`),
          );
        }
      })
      .once('listening', () => {
        server.close();
        resolve(portNumber);
      })
      .listen(portNumber, host);
    }

    _getPort(port || basePort);
  });
}
