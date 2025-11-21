import { WebSocket, Server } from 'ws';

export class SsrReloadServer {
  #server: Server;

  constructor() {
    this.#server = new WebSocket.Server({ port: 60_000 });
    process.on('SIGTERM', () => this.#server.close());
    process.on('exit', () => this.#server.close());
  }

  sendReload() {
    this.#server.clients.forEach((client) => {
      client.send('ssr-reload');
    });
  }
}
