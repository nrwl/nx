import { nxComponentTestingPreset } from './component-testing';
import { applyReactConfig } from '@nx/react/internal';

vi.mock('@nx/cypress/plugins/cypress-preset', () => ({
  nxBaseCypressPreset: () => ({}),
}));
vi.mock('@nx/cypress/internal', () => ({
  createExecutorContext: () => ({ root: '/workspace', projectName: 'app' }),
  getProjectConfigByPath: () => ({ name: 'app', targets: {} }),
}));
vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  readCachedProjectGraph: () => ({
    nodes: { app: { data: { root: 'apps/app' } } },
  }),
  readTargetOptions: () => ({}),
}));
vi.mock('@nx/react/internal', () => ({
  assertPackageIsInstalled: vi.fn(),
  applyReactConfig: vi.fn(),
}));

const webpackPath = require.resolve('@nx/webpack/internal');
const webpack = require(webpackPath);

describe('Next component testing webpack configuration', () => {
  afterEach(() => {
    require.cache[webpackPath].exports = webpack;
  });

  it('applies compiler, web, and React configuration without removed helpers', () => {
    const typescriptRule = { test: /\.tsx?$/, loader: 'swc-loader' };
    const cssRule = { test: /\.css$/, loader: 'css-loader' };
    const base = vi.fn((_options, config: any) => {
      config.module = { rules: [typescriptRule] };
    });
    const web = vi.fn((_options, config: any) => {
      config.module.rules.push(cssRule);
    });

    require.cache[webpackPath].exports = {
      applyBaseConfig: base,
      applyWebConfig: web,
    };
    const preset = nxComponentTestingPreset('apps/app/cypress.config.ts');
    const config = preset.devServer
      .webpackConfig as import('webpack').Configuration;

    expect(config.module.rules).toEqual([typescriptRule, cssRule]);
    expect(base).toHaveBeenCalledWith(
      expect.objectContaining({
        compiler: 'swc',
        target: 'web',
        projectRoot: 'apps/app',
      }),
      config
    );
    expect(web).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'web' }),
      config
    );
    expect(applyReactConfig).toHaveBeenCalledWith({}, config);
  });
});
