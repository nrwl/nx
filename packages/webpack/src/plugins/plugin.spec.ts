import { CreateNodesContext } from '@nx/devkit';
import { createNodesV2 } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';

describe('@nx/webpack/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('webpack-plugin');

    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
      configFiles: [],
    };

    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
    tempFs.createFileSync('my-app/webpack.config.js', '');
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should create nodes', async () => {
    mockWebpackConfig({
      output: {
        path: 'dist/foo',
      },
    });
    const nodes = await createNodesFunction(
      ['my-app/webpack.config.js'],
      {
        buildTargetName: 'build-something',
        serveTargetName: 'my-serve',
        previewTargetName: 'preview-site',
        serveStaticTargetName: 'serve-static',
      },
      context
    );

    expect(nodes).toMatchSnapshot();
  });

  function mockWebpackConfig(config: any) {
    jest.mock(join(tempFs.tempDir, 'my-app/webpack.config.js'), () => config, {
      virtual: true,
    });
  }
});
