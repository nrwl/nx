import { ExecutorContext } from '@nx/devkit';
import type { NodeExecutorOptions } from '@nx/js/src/executors/node/schema';
import { nodeExecutor as jsNodeExecutor } from '@nx/js/src/executors/node/node.impl';

// TODO(jack): Remove for Nx 16
export async function* nodeExecutor(
  options: NodeExecutorOptions,
  context: ExecutorContext
) {
  yield* jsNodeExecutor(options, context);
}

export default nodeExecutor;
