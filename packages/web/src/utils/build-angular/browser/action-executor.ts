/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import JestWorker from 'jest-worker';
import * as os from 'os';
import * as path from 'path';
import { ProcessBundleOptions, ProcessBundleResult } from '../utils/process-bundle';
import { BundleActionCache } from './action-cache';

let workerFile = require.resolve('../utils/process-bundle');
workerFile =
  path.extname(workerFile) === '.ts'
    ? require.resolve('../utils/process-bundle-bootstrap')
    : workerFile;

export class BundleActionExecutor {
  private largeWorker?: JestWorker;
  private smallWorker?: JestWorker;
  private cache: BundleActionCache;

  constructor(
    private workerOptions: unknown,
    integrityAlgorithm?: string,
    private readonly sizeThreshold = 32 * 1024,
  ) {
    this.cache = new BundleActionCache(integrityAlgorithm);
  }

  private static executeMethod<O>(worker: JestWorker, method: string, input: unknown): Promise<O> {
    return ((worker as unknown) as Record<string, (i: unknown) => Promise<O>>)[method](input);
  }

  private ensureLarge(): JestWorker {
    if (this.largeWorker) {
      return this.largeWorker;
    }

    // larger files are processed in a separate process to limit memory usage in the main process
    return (this.largeWorker = new JestWorker(workerFile, {
      exposedMethods: ['process'],
      setupArgs: [this.workerOptions],
    }));
  }

  private ensureSmall(): JestWorker {
    if (this.smallWorker) {
      return this.smallWorker;
    }

    // small files are processed in a limited number of threads to improve speed
    // The limited number also prevents a large increase in memory usage for an otherwise short operation
    return (this.smallWorker = new JestWorker(workerFile, {
      exposedMethods: ['process'],
      setupArgs: [this.workerOptions],
      numWorkers: os.cpus().length < 2 ? 1 : 2,
      // Will automatically fallback to processes if not supported
      enableWorkerThreads: true,
    }));
  }

  private executeAction<O>(method: string, action: { code: string }): Promise<O> {
    // code.length is not an exact byte count but close enough for this
    if (action.code.length > this.sizeThreshold) {
      return BundleActionExecutor.executeMethod<O>(this.ensureLarge(), method, action);
    } else {
      return BundleActionExecutor.executeMethod<O>(this.ensureSmall(), method, action);
    }
  }

  async process(action: ProcessBundleOptions) {
    const cacheKeys = this.cache.generateCacheKeys(action);
    action.cacheKeys = cacheKeys;

    // Try to get cached data, if it fails fallback to processing
    try {
      const cachedResult = await this.cache.getCachedBundleResult(action);
      if (cachedResult) {
        return cachedResult;
      }
    } catch {}

    return this.executeAction<ProcessBundleResult>('process', action);
  }

  async *processAll(actions: Iterable<ProcessBundleOptions>) {
    const executions = new Map<Promise<ProcessBundleResult>, Promise<ProcessBundleResult>>();
    for (const action of actions) {
      const execution = this.process(action);
      executions.set(
        execution,
        execution.then(result => {
          executions.delete(execution);

          return result;
        }),
      );
    }

    while (executions.size > 0) {
      yield Promise.race(executions.values());
    }
  }

  stop() {
    if (this.largeWorker) {
      this.largeWorker.end();
    }
    if (this.smallWorker) {
      this.smallWorker.end();
    }
  }
}
