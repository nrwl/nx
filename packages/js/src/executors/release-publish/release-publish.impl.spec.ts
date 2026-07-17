import {
  ExecutorContext,
  readJsonFile,
  detectPackageManager,
} from '@nx/devkit';
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
  const mockDetectPackageManager = detectPackageManager as jest.MockedFunction<
    typeof detectPackageManager
  >;
  const mockParseRegistryOptions =
    npmConfigModule.parseRegistryOptions as jest.MockedFunction<
      typeof npmConfigModule.parseRegistryOptions
    >;
  const mockReadJsonFile = readJsonFile as jest.MockedFunction<
    typeof readJsonFile
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectPackageManager.mockReturnValue('npm');
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

    // Default mock for npm --version check (first execSync call in the executor)
    mockExecSync.mockReturnValueOnce('11.5.1' as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('already published error handling', () => {
    function mockNpmViewNotFound() {
      mockExecSync.mockImplementationOnce(() => {
        const error: any = new Error('npm view failed');
        error.stdout = Buffer.from(
          JSON.stringify({
            error: {
              code: 'E404',
              summary: 'Not found',
            },
          })
        );
        error.stderr = Buffer.from('npm ERR! 404 Not Found');
        throw error;
      });
    }

    it('should skip publishing when pnpm reports that the version was previously published', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockNpmViewNotFound();
      mockExecSync.mockImplementationOnce(() => {
        const error: any = new Error('pnpm publish failed');
        error.stdout = Buffer.from(
          JSON.stringify({
            error: {
              code: 'E403',
              message:
                'You cannot publish over the previously published versions: 1.0.0.',
            },
          })
        );
        error.stderr = Buffer.from('');
        throw error;
      });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('has already been published')
      );
      expect(console.error).not.toHaveBeenCalledWith('pnpm publish error:');
    });

    it('should skip publishing when raw publish output says the version was previously published', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockNpmViewNotFound();
      mockExecSync.mockImplementationOnce(() => {
        const error: any = new Error('pnpm publish failed');
        error.stdout = Buffer.from('not json');
        error.stderr = Buffer.from(
          'ERR_PNPM_PUBLISH_CONFLICT 403 Forbidden - You cannot publish over the previously published versions: 1.0.0.'
        );
        throw error;
      });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('has already been published')
      );
      expect(console.error).not.toHaveBeenCalledWith('pnpm publish error:');
    });

    it('should fail when pnpm publish returns a generic 403 error', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockNpmViewNotFound();
      mockExecSync.mockImplementationOnce(() => {
        const error: any = new Error('pnpm publish failed');
        error.stdout = Buffer.from(
          JSON.stringify({
            error: {
              code: 'E403',
              message: '403 Forbidden - You do not have permission to publish',
            },
          })
        );
        error.stderr = Buffer.from('');
        throw error;
      });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('pnpm publish error:');
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('has already been published')
      );
    });
  });

  describe('nxReleaseVersionData skip behavior', () => {
    it('should skip publishing when nxReleaseVersionData indicates no new version', async () => {
      const optionsWithVersionData = {
        ...options,
        nxReleaseVersionData: {
          'test-project': {
            currentVersion: '1.0.0',
            newVersion: null,
            dependentProjects: [],
          },
        },
      };

      const result = await runExecutor(optionsWithVersionData, context);

      expect(result.success).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipped')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('no new version was resolved')
      );
      // Should only have called npm --version, not npm view or npm publish
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it('should proceed with publishing when nxReleaseVersionData indicates a new version', async () => {
      mockExecSync
        .mockReturnValueOnce(
          Buffer.from(
            JSON.stringify({
              versions: ['0.9.0'],
              'dist-tags': { latest: '0.9.0' },
            })
          )
        ) // npm view
        .mockReturnValueOnce(Buffer.from('{}') as any); // npm publish

      jest.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue({
        beforeJsonData: '',
        jsonData: {
          id: '@scope/test-package@1.0.0',
          name: '@scope/test-package',
          version: '1.0.0',
          size: 100,
          unpackedSize: 200,
          shasum: 'abc123',
          integrity: 'sha512-abc',
          filename: 'test-package-1.0.0.tgz',
          files: [],
          entryCount: 1,
          bundled: [],
        },
        afterJsonData: '',
      } as any);

      const optionsWithVersionData = {
        ...options,
        nxReleaseVersionData: {
          'test-project': {
            currentVersion: '0.9.0',
            newVersion: '1.0.0',
            dependentProjects: [],
          },
        },
      };

      const result = await runExecutor(optionsWithVersionData, context);

      expect(result.success).toBe(true);
      // Should have proceeded with npm --version, npm view, and publish
      expect(mockExecSync).toHaveBeenCalledTimes(3);
    });

    it('should proceed with publishing when nxReleaseVersionData is not provided', async () => {
      mockExecSync
        .mockReturnValueOnce(
          Buffer.from(
            JSON.stringify({
              versions: ['0.9.0'],
              'dist-tags': { latest: '0.9.0' },
            })
          )
        ) // npm view
        .mockReturnValueOnce(Buffer.from('{}') as any); // npm publish

      jest.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue({
        beforeJsonData: '',
        jsonData: {
          id: '@scope/test-package@1.0.0',
          name: '@scope/test-package',
          version: '1.0.0',
          size: 100,
          unpackedSize: 200,
          shasum: 'abc123',
          integrity: 'sha512-abc',
          filename: 'test-package-1.0.0.tgz',
          files: [],
          entryCount: 1,
          bundled: [],
        },
        afterJsonData: '',
      } as any);

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      // Should have proceeded with npm --version, npm view, and publish
      expect(mockExecSync).toHaveBeenCalledTimes(3);
    });
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

  describe('npm availability check', () => {
    it('should continue without error when pm is bun and npm is not installed', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExecSync.mockReset();

      // npm --version throws (npm not installed)
      mockExecSync
        .mockImplementationOnce(() => {
          throw new Error('Command not found: npm');
        })
        // bun info call for view command
        .mockReturnValueOnce(
          Buffer.from(
            JSON.stringify({
              versions: ['0.9.0'],
              'dist-tags': { latest: '0.9.0' },
            })
          )
        )
        // bun publish call
        .mockReturnValueOnce(Buffer.from('bun publish output'));

      jest
        .spyOn(extractModule, 'extractNpmPublishJsonData')
        .mockReturnValue(null);

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      // Verify the view command used bun info (not npm view)
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('bun info'),
        expect.anything()
      );
      // Verify npm dist-tag add was NOT called (npm not installed)
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('npm dist-tag add'),
        expect.anything()
      );
    });

    it('should fall back to npm publish when bun publish fails with an authentication error and npm is installed', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExecSync.mockReset();

      mockExecSync
        // npm --version succeeds (npm is installed)
        .mockReturnValueOnce('11.5.1' as any)
        // bun info (view) call
        .mockReturnValueOnce(
          Buffer.from(
            JSON.stringify({
              versions: ['0.9.0'],
              'dist-tags': { latest: '0.9.0' },
            })
          )
        )
        // bun publish fails with missing authentication
        .mockImplementationOnce(() => {
          const error: any = new Error('bun publish failed');
          error.stdout = Buffer.from('');
          error.stderr = Buffer.from(
            'error: missing authentication (run `bunx npm login`)'
          );
          throw error;
        })
        // npm publish (fallback) succeeds
        .mockReturnValueOnce(Buffer.from('{}') as any);

      jest.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue({
        beforeJsonData: '',
        jsonData: {
          id: '@scope/test-package@1.0.0',
          name: '@scope/test-package',
          version: '1.0.0',
          size: 100,
          unpackedSize: 200,
          shasum: 'abc123',
          integrity: 'sha512-abc',
          filename: 'test-package-1.0.0.tgz',
          files: [],
          entryCount: 1,
          bundled: [],
        },
        afterJsonData: '',
      } as any);

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      // bun publish was tried first
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('bun publish'),
        expect.anything()
      );
      // npm publish was tried after bun failed
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('npm publish'),
        expect.anything()
      );
      // the user-facing fallback warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('falling back to npm publish')
      );
    });

    it('should not fall back to npm publish when bun publish fails with a non-auth error', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExecSync.mockReset();

      mockExecSync
        // npm --version succeeds (npm is installed)
        .mockReturnValueOnce('11.5.1' as any)
        // bun info (view) call
        .mockReturnValueOnce(
          Buffer.from(
            JSON.stringify({
              versions: ['0.9.0'],
              'dist-tags': { latest: '0.9.0' },
            })
          )
        )
        // bun publish fails with a non-auth error (e.g., version conflict)
        .mockImplementationOnce(() => {
          const error: any = new Error('bun publish failed');
          error.stdout = Buffer.from('');
          error.stderr = Buffer.from(
            'error: version 1.0.0 already exists in the registry'
          );
          throw error;
        });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('bun publish error:');
      // npm publish must NOT be attempted for non-auth bun errors
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('npm publish'),
        expect.anything()
      );
      // the fallback warning must NOT have been logged
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('falling back to npm publish')
      );
    });

    it('should not fall back to npm publish when bun publish fails with an authentication error but npm is not installed', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExecSync.mockReset();

      mockExecSync
        // npm --version throws (npm not installed)
        .mockImplementationOnce(() => {
          throw new Error('Command not found: npm');
        })
        // bun info (view) call
        .mockReturnValueOnce(
          Buffer.from(
            JSON.stringify({
              versions: ['0.9.0'],
              'dist-tags': { latest: '0.9.0' },
            })
          )
        )
        // bun publish fails with an auth error — but npm is unavailable, so no fallback
        .mockImplementationOnce(() => {
          const error: any = new Error('bun publish failed');
          error.stdout = Buffer.from('');
          error.stderr = Buffer.from(
            'error: missing authentication (run `bunx npm login`)'
          );
          throw error;
        });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('bun publish error:');
      // npm publish must NOT be attempted when npm is unavailable
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('npm publish'),
        expect.anything()
      );
    });

    it('should return failure when pm is not bun and npm is not installed', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockExecSync.mockReset();

      // npm --version throws (npm not installed)
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('Command not found: npm');
      });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('npm was not found in the current environment')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('"pnpm"')
      );
    });
  });
});
