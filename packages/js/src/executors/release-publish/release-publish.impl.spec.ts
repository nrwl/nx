import { ExecutorContext, readJsonFile } from '@nx/devkit';
import { execSync } from 'child_process';
import { PublishExecutorSchema } from './schema';
import runExecutor from './release-publish.impl';
import * as npmConfigModule from '../../utils/npm-config';
import * as npmRunPath from 'npm-run-path';
import * as extractModule from './extract-npm-publish-json-data';

jest.mock('child_process');
jest.mock('npm-run-path', () => ({
  env: jest.fn(() => ({})),
}));
jest.mock('../../utils/npm-config');
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(() => 'npm'),
  readJsonFile: jest.fn(),
}));
jest.mock('./extract-npm-publish-json-data');
jest.mock('./log-tar');

describe('release-publish executor', () => {
  let context: ExecutorContext;
  let options: PublishExecutorSchema;
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
  const mockParseRegistryOptions =
    npmConfigModule.parseRegistryOptions as jest.MockedFunction<
      typeof npmConfigModule.parseRegistryOptions
    >;
  const mockReadJsonFile = readJsonFile as jest.MockedFunction<
    typeof readJsonFile
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    context = {
      root: '/root',
      cwd: '/root',
      projectGraph: {
        nodes: {},
        dependencies: {},
      },
      projectsConfigurations: {
        version: 2,
        projects: {
          'test-project': {
            root: 'packages/test-package',
          },
        },
      },
      nxJsonConfiguration: {},
      isVerbose: false,
      projectName: 'test-project',
      targetName: 'release-publish',
    };

    options = {
      packageRoot: 'packages/test-package',
    };

    // Mock package.json reading
    mockReadJsonFile.mockReturnValue({
      name: '@scope/test-package',
      version: '1.0.0',
    });

    // Mock npm config parsing
    mockParseRegistryOptions.mockResolvedValue({
      registry: 'https://registry.npmjs.org/',
      tag: 'latest',
      registryConfigKey: 'registry',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('npm dist-tag error handling', () => {
    it('returns failure and logs only the dist-tag add error when add fails with empty stdout', async () => {
      mockExecSync
        .mockReturnValueOnce(
          Buffer.from(
            JSON.stringify({
              versions: ['1.0.0'],
              'dist-tags': { latest: '0.9.0' },
            })
          )
        )
        .mockImplementationOnce(() => {
          const error: any = new Error('npm dist-tag add failed');
          error.stdout = Buffer.from('');
          error.stderr = Buffer.from('npm ERR! permission denied');
          error.code = 1;
          throw error;
        });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('npm dist-tag add error:');
      expect(console.error).not.toHaveBeenCalledWith(
        'Something unexpected went wrong when processing the npm dist-tag add output\n',
        expect.any(Error)
      );
    });
  });
});
