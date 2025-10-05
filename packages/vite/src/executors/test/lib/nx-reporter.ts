import type { File, Reporter } from 'vitest';

export class NxReporter implements Reporter {
  deferred: {
    promise: Promise<boolean>;
    resolve: (val: boolean) => void;
  };

  constructor(private watch: boolean) {
    this.setupDeferred();
  }

  async *[Symbol.asyncIterator]() {
    do {
      const hasErrors = await this.deferred.promise;
      yield { hasErrors };
      this.setupDeferred();
    } while (this.watch);
  }

  private setupDeferred() {
    let resolve: (val: boolean) => void;
    this.deferred = {
      promise: new Promise((res) => {
        resolve = res;
      }),
      resolve,
    };
  }

  /** Vitest ≥ 0.29 */
  onTestRunEnd(files: any[], errors?: any) {
    this._handleFinished(files, errors);
  }
  /** Vitest ≤ 0.28 */
  onFinished(files: File[], errors?: unknown[]) {
    this._handleFinished(files, errors);
  }

  // --- private ----------------------------------------------------------
  private _handleFinished(files: any[], errors?: any) {
    const hasErrors =
      files.some((f) => f.result?.state === 'fail') || errors?.length > 0;
    this.deferred.resolve(hasErrors);
  }
}
