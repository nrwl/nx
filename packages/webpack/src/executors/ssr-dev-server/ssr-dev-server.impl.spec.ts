import { logger, type ExecutorContext } from '@nx/devkit';
import schema from './schema.json';
import ssrDevServerExecutor from './ssr-dev-server.impl';

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  parseTargetString: vi.fn(() => ({ project: 'app', target: 'build' })),
  readTargetOptions: vi.fn(() => ({})),
  runExecutor: vi.fn(async () => (async function* () {})()),
}));

describe('ssrDevServerExecutor', () => {
  it('warns with the deprecation message from its schema', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await ssrDevServerExecutor(
      { browserTarget: 'app:build', serverTarget: 'app:server' } as any,
      {} as ExecutorContext
    ).next();

    expect(warn).toHaveBeenCalledExactlyOnceWith(schema['x-deprecated']);
  });
});
