import * as crypto from 'crypto';
import * as fs from 'fs';
import { parentPort } from 'worker_threads';

const handlers = {
  hashFile: (filePath) =>
    new Promise((resolve, reject) => {
      const hasher = crypto.createHash('sha256');
      fs.createReadStream(filePath)
        .on('error', reject)
        .pipe(hasher)
        .on('error', reject)
        .on('finish', () => {
          const { buffer } = hasher.read();
          resolve({ value: buffer, transferList: [buffer] });
        });
    }),
  hashArray: async (input) => {
    const hasher = crypto.createHash('sha256');
    for (const part of input) {
      hasher.update(part);
    }
    const hash = hasher.digest().buffer;
    return { value: hash, transferList: [hash] };
  },
};

parentPort.on('message', async (message) => {
  try {
    const { method, arg } = message;
    const handler = handlers[method];
    const { value, transferList } = await handler(arg);
    parentPort.postMessage({ id: message.id, value }, transferList);
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      error: { message: error.message, stack: error.stack },
    });
  }
});
