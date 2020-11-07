import * as crypto from 'crypto';
import { readFileSync } from 'fs';
import { sortObject } from '../../utils/object-utils';

export class HashingImp {
  hashObject(input: any): string {
    const hasher = crypto.createHash('sha256');

    // Sort the properties before stringifying and hashing so that reordering properties in an object
    // does not cause a cache miss.
    const sortedObject = sortObject(input);

    hasher.update(JSON.stringify(sortedObject));

    const hash = hasher.digest().buffer;
    return Buffer.from(hash).toString('hex');
  }

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
