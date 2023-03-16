import type { Mode } from '@rspack/core';

export interface DevServerExecutorSchema {
  buildTarget: string;
  mode?: Mode;

  port?: number;
}
