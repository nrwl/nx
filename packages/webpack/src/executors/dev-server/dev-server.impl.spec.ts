import type { ExecutorContext } from '@nx/devkit';
import { of } from 'rxjs';
import { resolveUserDefinedWebpackConfig } from '../../utils/webpack/resolve-user-defined-webpack-config';
import { runWebpackDevServer } from '../../utils/run-webpack';
import devServerExecutor from './dev-server.impl';

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  parseTargetString: vi.fn(() => ({ project: 'app', target: 'build' })),
  readTargetOptions: vi.fn(() => ({
    webpackConfig: 'apps/app/webpack.config.js',
    buildLibsFromSource: true,
  })),
}));
vi.mock('@nx/js', () => ({ getRootTsConfigPath: () => 'tsconfig.base.json' }));
vi.mock('../webpack/lib/normalize-options', () => ({
  normalizeOptions: (options) => ({ ...options }),
}));
vi.mock('./lib/get-dev-server-config', () => ({
  getDevServerOptions: () => ({ port: 4321 }),
}));
vi.mock('../../utils/webpack/resolve-user-defined-webpack-config', () => ({
  resolveUserDefinedWebpackConfig: vi.fn(),
}));
vi.mock('../../utils/run-webpack', () => ({
  runWebpackDevServer: vi.fn(() =>
    of({
      baseUrl: 'http://localhost:4321',
      stats: { toString: () => '', hasErrors: () => false },
    })
  ),
}));

const context = {
  root: '/root',
  projectName: 'app',
  projectsConfigurations: {
    projects: { app: { root: 'apps/app', sourceRoot: 'apps/app/src' } },
  },
} as unknown as ExecutorContext;

async function servedConfig(userConfig: unknown) {
  vi.mocked(resolveUserDefinedWebpackConfig).mockReturnValue(userConfig);
  for await (const _ of devServerExecutor(
    { buildTarget: 'app:build' } as any,
    context
  )) {
    break;
  }
  return vi.mocked(runWebpackDevServer).mock.lastCall[0];
}

describe('devServerExecutor', () => {
  it('applies the target dev server options to a config function that ignores its arguments', async () => {
    const config = await servedConfig(async () => ({ mode: 'development' }));
    expect(config.devServer).toEqual({ port: 4321 });
  });

  it('keeps the dev server options a config function returns', async () => {
    const config = await servedConfig(async () => ({
      devServer: { port: 9000 },
    }));
    expect(config.devServer).toEqual({ port: 9000 });
  });
});
