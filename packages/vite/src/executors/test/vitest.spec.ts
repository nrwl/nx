import { VitestExecutorSchema } from './schema';
import executor from './vitest.impl';

const options: VitestExecutorSchema = {};

describe('Test Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});
