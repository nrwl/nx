import { createHash } from 'crypto';
import { readFileSync } from 'fs';

export class HashingImpl {
  hashArray(input: string[]): string {
    const hasher = createHash('sha256');
    for (const part of input) {
      // intentional single equals to check for null and undefined
      if (part != undefined) {
        hasher.update(part);
      }
    }
    return hasher.digest('hex');
  }

  hashFile(path: string): string {
    const hasher = createHash('sha256');
    const file = readFileSync(path);
    hasher.update(file);
    return hasher.digest('hex');
  }
}

export const defaultHashing = new HashingImpl();
