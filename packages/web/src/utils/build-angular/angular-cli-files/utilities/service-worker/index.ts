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
  virtualFs,
} from '@angular-devkit/core';
import {
  Filesystem,
  Generator,
} from '@angular/service-worker/config'; // tslint:disable-line:no-implicit-dependencies
import * as crypto from 'crypto';

class CliFilesystem implements Filesystem {
  constructor(private _host: virtualFs.Host, private base: string) { }

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
    return this._host.write(this._resolve(path), virtualFs.stringToFileBuffer(content))
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
  ngswConfigPath?: string,
): Promise<void> {
  const distPath = normalize(outputPath);
  const systemProjectRoot = getSystemPath(projectRoot);

  // Find the service worker package
  const workerPath = normalize(
    require.resolve('@angular/service-worker/ngsw-worker.js', { paths: [systemProjectRoot] }),
  );
  const swConfigPath = require.resolve(
    '@angular/service-worker/config',
    { paths: [systemProjectRoot] },
  );

  // Determine the configuration file path
  let configPath;
  if (ngswConfigPath) {
    configPath = normalize(ngswConfigPath);
  } else {
    configPath = join(appRoot, 'ngsw-config.json');
  }

  // Ensure the configuration file exists
  const configExists = await host.exists(configPath).toPromise();
  if (!configExists) {
    throw new Error(tags.oneLine`
      Error: Expected to find an ngsw-config.json configuration
      file in the ${getSystemPath(appRoot)} folder. Either provide one or disable Service Worker
      in your angular.json configuration file.
    `);
  }

  // Read the configuration file
  const config = JSON.parse(virtualFs.fileBufferToString(await host.read(configPath).toPromise()));

  // Generate the manifest
  const GeneratorConstructor = require(swConfigPath).Generator as typeof Generator;
  const generator = new GeneratorConstructor(new CliFilesystem(host, outputPath), baseHref);
  const output = await generator.process(config);

  // Write the manifest
  const manifest = JSON.stringify(output, null, 2);
  await host.write(join(distPath, 'ngsw.json'), virtualFs.stringToFileBuffer(manifest)).toPromise();

  // Write the worker code
  // NOTE: This is inefficient (kernel -> userspace -> kernel).
  //       `fs.copyFile` would be a better option but breaks the host abstraction
  const workerCode = await host.read(workerPath).toPromise();
  await host.write(join(distPath, 'ngsw-worker.js'), workerCode).toPromise();

  // If present, write the safety worker code
  const safetyPath = join(dirname(workerPath), 'safety-worker.js');
  if (await host.exists(safetyPath).toPromise()) {
    const safetyCode = await host.read(safetyPath).toPromise();

    await host.write(join(distPath, 'worker-basic.min.js'), safetyCode).toPromise();
    await host.write(join(distPath, 'safety-worker.js'), safetyCode).toPromise();
  }
}
