import { type CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import { createNodesV2 } from './plugin';

describe('@nx/react-native/plugin', () => {
  const createNodesFunction = createNodesV2[1];
  const originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
  let tempFs: TempFs;
  let context: CreateNodesContext;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    tempFs = new TempFs('react-native-plugin');
    context = {
      nxJsonConfiguration: { namedInputs: { default: ['{projectRoot}/**/*'] } },
      workspaceRoot: tempFs.tempDir,
    };
    tempFs.createFileSync('package-lock.json', '{}');
  });

  afterEach(() => {
    tempFs.cleanup();
    if (originalCacheProjectGraph !== undefined) {
      process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    } else {
      delete process.env.NX_CACHE_PROJECT_GRAPH;
    }
  });

  async function inferStartTarget(projectRoot: string) {
    tempFs.createFileSync(join(projectRoot, 'app.json'), '{"name":"mobile"}');
    tempFs.createFileSync(join(projectRoot, 'package.json'), '{}');
    tempFs.createFileSync(join(projectRoot, 'metro.config.js'), '');
    const [[, { projects }]] = await createNodesFunction(
      [join(projectRoot, 'app.json')],
      {},
      context
    );
    return projects[projectRoot].targets.start;
  }

  it.each([
    [
      'apps/mobile',
      '../../node_modules/@nx/react-native/dist/plugins/metro-reporter.js',
    ],
    ['.', './node_modules/@nx/react-native/dist/plugins/metro-reporter.js'],
  ])(
    'starts Metro with the ready signal reporter (%s)',
    async (projectRoot, reporterPath) => {
      tempFs.createFileSync(
        'node_modules/@nx/react-native/dist/plugins/metro-reporter.js',
        ''
      );
      expect(await inferStartTarget(projectRoot)).toEqual({
        command: `react-native start --custom-log-reporter-path ${reporterPath}`,
        continuous: true,
        options: { cwd: projectRoot },
        readyWhen: { signal: true },
      });
    }
  );

  it('starts Metro without a readiness check when the root node_modules has no reporter', async () => {
    expect(await inferStartTarget('apps/mobile')).toEqual({
      command: 'react-native start',
      continuous: true,
      options: { cwd: 'apps/mobile' },
    });
  });
});
