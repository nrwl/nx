import { ExecutorContext } from '@nx/devkit';
import { RspackExecutorSchema } from '../executors/rspack/schema';

export interface SharedConfigContext {
  options: RspackExecutorSchema;
  context: ExecutorContext;
}
