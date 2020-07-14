import * as crypto from 'crypto';
import { readFileSync } from 'fs';

export class HashingImp {
  hashArray(input: string[]): string {
    const hasher = crypto.createHash('sha256');
    for (const part of input) {
      hasher.update(part);
    }
    const hash = hasher.digest().buffer;
    return Buffer.from(hash).toString('hex');
  }

  hashFile(path: string): string {
    const hasher = crypto.createHash('sha256');
    const file = readFileSync(path);
    hasher.update(file);
    const hash = hasher.digest().buffer;
    return Buffer.from(hash).toString('hex');
  }
}

export const defaultHashing = new HashingImp();
