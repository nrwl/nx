import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { exec } from 'child_process';

export class HashingImpl {
  hashArray(input: string[]): string {
    const hasher = createHash('sha256');
    for (const part of input) {
      hasher.update(part);
    }
    return hasher.digest('hex');
  }

  hashFile(path: string): string {
    const hasher = createHash('sha256');
    const file = readFileSync(path);
    hasher.update(file);
    return hasher.digest('hex');
  }

  async hashRuntimeInputs(runtimeCacheInputs: string[]) {
    const values = (await Promise.all(
      runtimeCacheInputs.map(
        (input) =>
          new Promise((res, rej) => {
            exec(input, (err, stdout, stderr) => {
              if (err) {
                rej(err);
              } else {
                res({ input, value: `${stdout}${stderr}`.trim() });
              }
            });
          })
      )
    )) as any;

    const value = this.hashArray(values.map((v) => v.value));
    const runtime = values.reduce((m, c) => ((m[c.input] = c.value), m), {});

    return { value, runtime };
  }
}

export const defaultHashing = new HashingImpl();
