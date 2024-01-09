import * as detectPort from 'detect-port';
import { socket } from 'zeromq';
import { Serializable } from 'child_process';

export class Publisher {
  private socket = socket('pub');
  public address: string;

  async init() {
    const port = await detectPort(49152);

    this.address = `tcp://127.0.0.1:${port}`;
    this.socket.bindSync(this.address);
  }

  publish(message: Serializable) {
    this.socket.send(['message', message.toString()]);
  }
}
