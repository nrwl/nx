import { workspaceRoot } from '../utils/workspace-root';
import { join } from 'path';
import { performance } from 'perf_hooks';
import {
  DefaultTasksRunnerOptions,
  RemoteCache,
  RemoteCacheV2,
} from './default-tasks-runner';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cacheDir } from '../utils/cache-directory';
import { Task } from '../config/task-graph';
import { machineId } from 'node-machine-id';
import { NxCache, CachedResult as NativeCacheResult } from '../native';
import { getDbConnection } from '../utils/db-connection';
import { isNxCloudUsed } from '../utils/nx-cloud-utils';
import { NxJsonConfiguration, readNxJson } from '../config/nx-json';
import { verifyOrUpdateNxCloudClient } from '../nx-cloud/update-manager';
import { getCloudOptions } from '../nx-cloud/utilities/get-cloud-options';
import { isCI } from '../utils/is-ci';
import { output } from '../utils/output';

export type CachedResult = {
  terminalOutput: string;
  outputsPath: string;
  code: number;
  remote: boolean;
};
export type TaskWithCachedResult = { task: Task; cachedResult: CachedResult };

export function dbCacheEnabled(nxJson: NxJsonConfiguration = readNxJson()) {
  return (
    process.env.NX_DISABLE_DB !== 'true' &&
    nxJson.useLegacyCache !== true &&
    process.env.NX_DB_CACHE !== 'false'
  );
}

// Do not change the order of these arguments as this function is used by nx cloud
export function getCache(options: DefaultTasksRunnerOptions): DbCache | Cache {
  const nxJson = readNxJson();
  return dbCacheEnabled(nxJson)
    ? new DbCache({
        // Remove this in Nx 21
        nxCloudRemoteCache: isNxCloudUsed(nxJson) ? options.remoteCache : null,
      })
    : new Cache(options);
}

export class DbCache {
  private cache = new NxCache(workspaceRoot, cacheDir, getDbConnection());

  private remoteCache: RemoteCacheV2 | null;
  private remoteCachePromise: Promise<RemoteCacheV2>;

  constructor(private readonly options: { nxCloudRemoteCache: RemoteCache }) {}

  async init() {
    // This should be cheap because we've already loaded
    this.remoteCache = await this.getRemoteCache();
    if (!this.remoteCache) {
      this.assertCacheIsValid();
    }
  }

  async get(task: Task): Promise<CachedResult | null> {
    const res = this.cache.get(task.hash);

    if (res) {
      return {
        ...res,
        remote: false,
      };
    }
    if (this.remoteCache) {
      // didn't find it locally but we have a remote cache
      // attempt remote cache
      const res = await this.remoteCache.retrieve(
        task.hash,
        this.cache.cacheDirectory
      );

      if (res) {
        this.applyRemoteCacheResults(task.hash, res);

        return {
          ...res,
          remote: true,
        };
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  private applyRemoteCacheResults(hash: string, res: NativeCacheResult) {
    return this.cache.applyRemoteCacheResults(hash, res);
  }

  async put(
    task: Task,
    terminalOutput: string | null,
    outputs: string[],
    code: number
  ) {
    return tryAndRetry(async () => {
      this.cache.put(task.hash, terminalOutput, outputs, code);

      if (this.remoteCache) {
        await this.remoteCache.store(
          task.hash,
          this.cache.cacheDirectory,
          terminalOutput,
          code
        );
      }
    });
  }

  copyFilesFromCache(_: string, cachedResult: CachedResult, outputs: string[]) {
    return tryAndRetry(async () =>
      this.cache.copyFilesFromCache(cachedResult, outputs)
    );
  }

  removeOldCacheRecords() {
    return this.cache.removeOldCacheRecords();
  }

  temporaryOutputPath(task: Task) {
    return this.cache.getTaskOutputsPath(task.hash);
  }

  private async getRemoteCache(): Promise<RemoteCacheV2 | null> {
    if (this.remoteCachePromise) {
      return this.remoteCachePromise;
    }

    this.remoteCachePromise = this._getRemoteCache();
    return this.remoteCachePromise;
  }

  private async _getRemoteCache(): Promise<RemoteCacheV2 | null> {
    const nxJson = readNxJson();
    if (isNxCloudUsed(nxJson)) {
      const options = getCloudOptions();
      const { nxCloudClient } = await verifyOrUpdateNxCloudClient(options);
      if (nxCloudClient.getRemoteCache) {
        return nxCloudClient.getRemoteCache();
      } else {
        // old nx cloud instance
        return await RemoteCacheV2.fromCacheV1(this.options.nxCloudRemoteCache);
      }
    } else {
      return (
        (await this.getPowerpackS3Cache()) ??
        (await this.getPowerpackSharedCache()) ??
        null
      );
    }
  }

  private getPowerpackS3Cache(): Promise<RemoteCacheV2 | null> {
    return this.getPowerpackCache('@nx/powerpack-s3-cache');
  }

  private getPowerpackSharedCache(): Promise<RemoteCacheV2 | null> {
    return this.getPowerpackCache('@nx/powerpack-shared-fs-cache');
  }

  private async getPowerpackCache(pkg: string): Promise<RemoteCacheV2 | null> {
    let getRemoteCache = null;
    try {
      getRemoteCache = (await import(this.resolvePackage(pkg))).getRemoteCache;
    } catch {
      return null;
    }
    return getRemoteCache();
  }

  private resolvePackage(pkg: string) {
    return require.resolve(pkg, {
      paths: [process.cwd(), workspaceRoot, __dirname],
    });
  }

  private assertCacheIsValid() {
    // User has customized the cache directory - this could be because they
    // are using a shared cache in the custom directory. The db cache is not
    // stored in the cache directory, and is keyed by machine ID so they would
    // hit issues. If we detect this, we can create a fallback db cache in the
    // custom directory, and check if the entries are there when the main db
    // cache misses.
    if (isCI() && !this.cache.checkCacheFsInSync()) {
      const warningLines = [
        `Nx found unrecognized artifacts in the cache directory and will not be able to use them.`,
        `Nx can only restore artifacts it has metadata about.`,
        `Read about this warning and how to address it here: https://nx.dev/troubleshooting/unknown-local-cache`,
        ``,
      ];
      output.warn({
        title: 'Unrecognized Cache Artifacts',
        bodyLines: warningLines,
      });
    }
  }
}

/**
 * @deprecated Use the {@link DbCache} class instead. This will be removed in Nx 21.
 */
export class Cache {
  root = workspaceRoot;
  cachePath = this.createCacheDir();
  terminalOutputsDir = this.createTerminalOutputsDir();

  private _currentMachineId: string = null;

  constructor(private readonly options: DefaultTasksRunnerOptions) {}

  removeOldCacheRecords() {
    /**
     * Even though spawning a process is fast, we don't want to do it every time
     * the user runs a command. Instead, we want to do it once in a while.
     */
    const shouldSpawnProcess = Math.floor(Math.random() * 50) === 1;
    if (shouldSpawnProcess) {
      const scriptPath = require.resolve('./remove-old-cache-records.js');
      try {
        const p = spawn('node', [scriptPath, `${this.cachePath}`], {
          stdio: 'ignore',
          detached: true,
          shell: false,
          windowsHide: true,
        });
        p.unref();
      } catch (e) {
        console.log(`Unable to start remove-old-cache-records script:`);
        console.log(e.message);
      }
    }
  }

  async currentMachineId() {
    if (!this._currentMachineId) {
      try {
        this._currentMachineId = await machineId();
      } catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.log(`Unable to get machineId. Error: ${e.message}`);
        }
        this._currentMachineId = '';
      }
    }
    return this._currentMachineId;
  }

  async get(task: Task): Promise<CachedResult | null> {
    const res = await this.getFromLocalDir(task);

    if (res) {
      await this.assertLocalCacheValidity(task);
      return { ...res, remote: false };
    } else if (this.options.remoteCache) {
      // didn't find it locally but we have a remote cache
      // attempt remote cache
      await this.options.remoteCache.retrieve(task.hash, this.cachePath);
      // try again from local cache
      const res2 = await this.getFromLocalDir(task);
      return res2 ? { ...res2, remote: true } : null;
    } else {
      return null;
    }
  }

  async put(
    task: Task,
    terminalOutput: string | null,
    outputs: string[],
    code: number
  ) {
    return tryAndRetry(async () => {
      /**
       * This is the directory with the cached artifacts
       */
      const td = join(this.cachePath, task.hash);
      const tdCommit = join(this.cachePath, `${task.hash}.commit`);

      // might be left overs from partially-completed cache invocations
      await this.remove(tdCommit);
      await this.remove(td);

      await mkdir(td, { recursive: true });
      await writeFile(
        join(td, 'terminalOutput'),
        terminalOutput ?? 'no terminal output'
      );

      await mkdir(join(td, 'outputs'));
      const expandedOutputs = await this.expandOutputsInWorkspace(outputs);

      await Promise.all(
        expandedOutputs.map(async (f) => {
          const src = join(this.root, f);
          if (existsSync(src)) {
            const cached = join(td, 'outputs', f);
            await this.copy(src, cached);
          }
        })
      );
      // we need this file to account for partial writes to the cache folder.
      // creating this file is atomic, whereas creating a folder is not.
      // so if the process gets terminated while we are copying stuff into cache,
      // the cache entry won't be used.
      await writeFile(join(td, 'code'), code.toString());
      await writeFile(join(td, 'source'), await this.currentMachineId());
      await writeFile(tdCommit, 'true');

      if (this.options.remoteCache) {
        await this.options.remoteCache.store(task.hash, this.cachePath);
      }

      if (terminalOutput) {
        const outputPath = this.temporaryOutputPath(task);
        await writeFile(outputPath, terminalOutput);
      }
    });
  }

  async copyFilesFromCache(
    hash: string,
    cachedResult: CachedResult,
    outputs: string[]
  ) {
    return tryAndRetry(async () => {
      const expandedOutputs = await this.expandOutputsInCache(
        outputs,
        cachedResult
      );
      await Promise.all(
        expandedOutputs.map(async (f) => {
          const cached = join(cachedResult.outputsPath, f);
          if (existsSync(cached)) {
            const src = join(this.root, f);
            await this.remove(src);
            await this.copy(cached, src);
          }
        })
      );
    });
  }

  temporaryOutputPath(task: Task) {
    return join(this.terminalOutputsDir, task.hash);
  }

  private async expandOutputsInWorkspace(outputs: string[]) {
    return this._expandOutputs(outputs, workspaceRoot);
  }

  private async expandOutputsInCache(
    outputs: string[],
    cachedResult: CachedResult
  ) {
    return this._expandOutputs(outputs, cachedResult.outputsPath);
  }

  private async _expandOutputs(
    outputs: string[],
    cwd: string
  ): Promise<string[]> {
    const { expandOutputs } = require('../native');
    performance.mark('expandOutputs:start');
    const results = expandOutputs(cwd, outputs);
    performance.mark('expandOutputs:end');
    performance.measure(
      'expandOutputs',
      'expandOutputs:start',
      'expandOutputs:end'
    );

    return results;
  }

  private async copy(src: string, destination: string): Promise<void> {
    const { copy } = require('../native');
    // 'cp -a /path/dir/ dest/' operates differently to 'cp -a /path/dir dest/'
    // --> which means actual build works but subsequent populate from cache (using cp -a) does not
    // --> the fix is to remove trailing slashes to ensure consistent & expected behaviour
    src = src.replace(/[\/\\]$/, '');

    return new Promise((res, rej) => {
      try {
        copy(src, destination);
        res();
      } catch (e) {
        rej(e);
      }
    });
  }

  private async remove(path: string): Promise<void> {
    const { remove } = require('../native');
    return new Promise((res, rej) => {
      try {
        remove(path);
        res();
      } catch (e) {
        rej(e);
      }
    });
  }

  private async getFromLocalDir(task: Task) {
    const tdCommit = join(this.cachePath, `${task.hash}.commit`);
    const td = join(this.cachePath, task.hash);

    if (existsSync(tdCommit)) {
      const terminalOutput = await readFile(
        join(td, 'terminalOutput'),
        'utf-8'
      );
      let code = 0;
      try {
        code = Number(await readFile(join(td, 'code'), 'utf-8'));
      } catch {}

      return {
        terminalOutput,
        outputsPath: join(td, 'outputs'),
        code,
      };
    } else {
      return null;
    }
  }

  private async assertLocalCacheValidity(task: Task) {
    const td = join(this.cachePath, task.hash);
    let sourceMachineId = null;
    try {
      sourceMachineId = await readFile(join(td, 'source'), 'utf-8');
    } catch {}

    if (sourceMachineId && sourceMachineId != (await this.currentMachineId())) {
      if (
        process.env.NX_REJECT_UNKNOWN_LOCAL_CACHE != '0' &&
        process.env.NX_REJECT_UNKNOWN_LOCAL_CACHE != 'false'
      ) {
        const error = [
          `Invalid Cache Directory for Task "${task.id}"`,
          `The local cache artifact in "${td}" was not generated on this machine.`,
          `As a result, the cache's content integrity cannot be confirmed, which may make cache restoration potentially unsafe.`,
          `If your machine ID has changed since the artifact was cached, run "nx reset" to fix this issue.`,
          `Read about the error and how to address it here: https://nx.dev/troubleshooting/unknown-local-cache`,
          ``,
        ].join('\n');
        throw new Error(error);
      }
    }
  }

  private createCacheDir() {
    mkdirSync(cacheDir, { recursive: true });
    return cacheDir;
  }

  private createTerminalOutputsDir() {
    const path = join(this.cachePath, 'terminalOutputs');
    mkdirSync(path, { recursive: true });
    return path;
  }
}

function tryAndRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  // Generate a random number between 2 and 4 to raise to the power of attempts
  const baseExponent = Math.random() * 2 + 2;
  const _try = async () => {
    try {
      attempts++;
      return await fn();
    } catch (e) {
      // Max time is 5 * 4^3 = 20480ms
      if (attempts === 6) {
        // After enough attempts, throw the error
        throw e;
      }
      await new Promise((res) => setTimeout(res, baseExponent ** attempts));
      return await _try();
    }
  };
  return _try();
}
