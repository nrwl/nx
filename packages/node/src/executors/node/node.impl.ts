import { ExecutorContext } from '@nrwl/devkit';
import type { NodeExecutorOptions } from '@nrwl/js/src/executors/node/schema';
import { nodeExecutor as jsNodeExecutor } from '@nrwl/js/src/executors/node/node.impl';

// TODO(jack): Remove for Nx 15
export async function* nodeExecutor(
  options: NodeExecutorOptions,
  context: ExecutorContext
) {
  yield* jsNodeExecutor(options, context);
}

export default nodeExecutor;
