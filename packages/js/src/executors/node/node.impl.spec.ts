import { NodeExecutorOptions } from './schema';
import executor from './node.impl';

const options: NodeExecutorOptions = {};

describe('Node Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});
