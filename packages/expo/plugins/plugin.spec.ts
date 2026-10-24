import { type CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodesV2 } from './plugin';

describe('@nx/expo/plugin', () => {
  const createNodesFunction = createNodesV2[1];
  let tempFs: TempFs;
  let context: CreateNodesContext;

  beforeEach(() => {
    vi.stubEnv('NX_CACHE_PROJECT_GRAPH', 'false');
    tempFs = new TempFs('expo-plugin');
    context = {
      nxJsonConfiguration: { namedInputs: { default: ['{projectRoot}/**/*'] } },
      workspaceRoot: tempFs.tempDir,
    };
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    tempFs.cleanup();
    vi.unstubAllEnvs();
  });

  it('waits for the Metro port before start and serve are ready', async () => {
    tempFs.createFileSync('apps/mobile/app.json', '{"expo":{}}');
    tempFs.createFileSync('apps/mobile/package.json', '{}');
    tempFs.createFileSync('apps/mobile/metro.config.js', '');

    const [[, { projects }]] = await createNodesFunction(
      ['apps/mobile/app.json'],
      {},
      context
    );

    const readyWhen = {
      command: `node -e "require('@nx/expo/ready-check').waitForDevServer()"`,
      interval: 1000,
    };
    expect(projects['apps/mobile'].targets.start.readyWhen).toEqual(readyWhen);
    expect(projects['apps/mobile'].targets.serve.readyWhen).toEqual(readyWhen);
  });
});
