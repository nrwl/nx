/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { Piscina } from 'piscina';

export type WorkerPoolOptions = ConstructorParameters<typeof Piscina>[0];

export class WorkerPool extends Piscina {
  constructor(options: WorkerPoolOptions) {
    const piscinaOptions: WorkerPoolOptions = {
      minThreads: 1,
      idleTimeout: 1000,
      recordTiming: false,
      ...options,
    };

    super(piscinaOptions);
  }
}
