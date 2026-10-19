import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';

export class SsrReloadServer {
  #server: WebSocketServer | undefined;
  #listening: Promise<unknown> | undefined;

  async getPort(): Promise<number> {
    if (!this.#server) {
      this.#server = new WebSocketServer({ port: 0 });
      this.#listening = once(this.#server, 'listening');
    }
    await this.#listening;
    return (this.#server.address() as AddressInfo).port;
  }

  sendReload() {
    this.#server?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('ssr-reload');
      }
    });
  }

  async close(): Promise<void> {
    if (!this.#server) {
      return;
    }
    this.#server.clients.forEach((client) => client.terminate());
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
