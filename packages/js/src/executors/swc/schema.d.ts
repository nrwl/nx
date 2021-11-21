import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';

export interface SwcExecutorOptions extends ExecutorOptions {
  skipTypeCheck?: boolean;
}

export interface NormalizedSwcExecutorOptions
  extends NormalizedExecutorOptions {
  skipTypeCheck: boolean;
}
