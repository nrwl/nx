/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  Path,
  dirname,
  getSystemPath,
  join,
  normalize,
  relative,
  tags,
  virtualFs
} from '@angular-devkit/core';
import * as crypto from 'crypto';

class CliFilesystem {
  constructor(private _host: virtualFs.Host, private base: string) {}

  list(path: string): Promise<string[]> {
    return this._recursiveList(this._resolve(path), []).catch(() => []);
  }

  async read(path: string): Promise<string> {
    return virtualFs.fileBufferToString(await this._readIntoBuffer(path));
  }

  async hash(path: string): Promise<string> {
    const sha1 = crypto.createHash('sha1');
    sha1.update(Buffer.from(await this._readIntoBuffer(path)));

    return sha1.digest('hex');
  }

  write(path: string, content: string): Promise<void> {
    return this._host
      .write(this._resolve(path), virtualFs.stringToFileBuffer(content))
      .toPromise();
  }

  private _readIntoBuffer(path: string): Promise<ArrayBuffer> {
    return this._host.read(this._resolve(path)).toPromise();
  }

  private _resolve(path: string): Path {
    return join(normalize(this.base), normalize(path));
  }

  private async _recursiveList(path: Path, items: string[]): Promise<string[]> {
    const fragments = await this._host.list(path).toPromise();

    for (const fragment of fragments) {
      const item = join(path, fragment);

      if (await this._host.isDirectory(item).toPromise()) {
        await this._recursiveList(item, items);
      } else {
        items.push('/' + relative(normalize(this.base), item));
      }
    }

    return items;
  }
}

export async function augmentAppWithServiceWorker(
  host: virtualFs.Host,
  projectRoot: Path,
  appRoot: Path,
  outputPath: Path,
  baseHref: string,
  ngswConfigPath?: string
): Promise<void> {
  throw new Error('not supported');
}
