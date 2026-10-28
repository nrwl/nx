import type { MockedFunction } from 'vitest';
import {
  ExecutorContext,
  readJsonFile,
  detectPackageManager,
} from '@nx/devkit';
import { safeExecFileSync } from '@nx/devkit/internal';
import { execSync } from 'child_process';
import { PublishExecutorSchema } from './schema';
import runExecutor from './release-publish.impl';
import * as npmConfigModule from '../../utils/npm-config';
import * as npmRunPath from 'npm-run-path';
import * as extractModule from './extract-npm-publish-json-data';

// `getPackageManagerVersion` still shells out through child_process, so pnpm
// flag resolution needs this even though the executor's own sinks do not.
vi.mock('child_process');
vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  safeExecFileSync: vi.fn(),
}));
vi.mock('npm-run-path', () => ({
  env: vi.fn(() => ({})),
}));
vi.mock('../../utils/npm-config');
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  detectPackageManager: vi.fn(() => 'npm'),
  readJsonFile: vi.fn(),
}));
vi.mock('./extract-npm-publish-json-data');
vi.mock('./log-tar');

describe('release-publish executor', () => {
  let context: ExecutorContext;
  let options: PublishExecutorSchema;
  const mockExec = safeExecFileSync as MockedFunction<typeof safeExecFileSync>;
  const mockExecSync = execSync as MockedFunction<typeof execSync>;
  const mockDetectPackageManager = detectPackageManager as MockedFunction<
    typeof detectPackageManager
  >;
  const mockParseRegistryOptions =
    npmConfigModule.parseRegistryOptions as MockedFunction<
      typeof npmConfigModule.parseRegistryOptions
    >;
  const mockReadJsonFile = readJsonFile as MockedFunction<typeof readJsonFile>;

  function npmViewNotFoundError() {
    const error: any = new Error('npm view failed');
    error.stdout = JSON.stringify({
      error: {
        code: 'E404',
        summary: 'No match found for version 1.0.0',
      },
    });
    error.stderr =
      'npm error code E404\nnpm error 404 No match found for version 1.0.0';
    return error;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectPackageManager.mockReturnValue('npm');
    vi.spyOn(console, 'log').mockImplementation();
    vi.spyOn(console, 'warn').mockImplementation();
    vi.spyOn(console, 'error').mockImplementation();

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

    // Default mock for npm --version check (first safeExecFileSync call in the executor)
    mockExec.mockReturnValueOnce('11.5.1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('already published error handling', () => {
    function mockNpmViewNotFound() {
      mockExec.mockImplementationOnce(() => {
        throw npmViewNotFoundError();
      });
    }

    // With no `packageManager` field at the workspace root, resolving pnpm's
    // flags runs `pnpm --version`; answer it before the publish call.
    function mockPnpmVersion() {
      mockExecSync.mockReturnValueOnce('10.0.0' as any);
    }

    it('should skip publishing when pnpm reports that the version was previously published', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockNpmViewNotFound();
      mockPnpmVersion();
      mockExec.mockImplementationOnce(() => {
        const error: any = new Error('pnpm publish failed');
        error.stdout = JSON.stringify({
          error: {
            code: 'E403',
            message:
              'You cannot publish over the previously published versions: 1.0.0.',
          },
        });
        error.stderr = '';
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
      mockPnpmVersion();
      mockExec.mockImplementationOnce(() => {
        const error: any = new Error('pnpm publish failed');
        error.stdout = 'not json';
        error.stderr =
          'ERR_PNPM_PUBLISH_CONFLICT 403 Forbidden - You cannot publish over the previously published versions: 1.0.0.';
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
      mockPnpmVersion();
      mockExec.mockImplementationOnce(() => {
        const error: any = new Error('pnpm publish failed');
        error.stdout = JSON.stringify({
          error: {
            code: 'E403',
            message: '403 Forbidden - You do not have permission to publish',
          },
        });
        error.stderr = '';
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
      expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it('should proceed with publishing when nxReleaseVersionData indicates a new version', async () => {
      mockExec
        .mockImplementationOnce(() => {
          throw npmViewNotFoundError();
        }) // npm view: version not published yet
        .mockReturnValueOnce('{}'); // npm publish

      vi.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue({
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
      expect(mockExec).toHaveBeenCalledTimes(3);
    });

    it('should proceed with publishing when nxReleaseVersionData is not provided', async () => {
      mockExec
        .mockImplementationOnce(() => {
          throw npmViewNotFoundError();
        }) // npm view: version not published yet
        .mockReturnValueOnce('{}'); // npm publish

      vi.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue({
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
      expect(mockExec).toHaveBeenCalledTimes(3);
    });
  });

  describe('npm metadata lookup', () => {
    it('queries the current version and requested dist-tag together', async () => {
      mockExec
        .mockReturnValueOnce(
          JSON.stringify({
            name: '@scope/test-package',
            version: '1.0.0',
            'dist-tags[latest]': '0.9.0',
          })
        )
        .mockReturnValueOnce('');

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenNthCalledWith(
        2,
        'npm',
        [
          'view',
          '@scope/test-package@1.0.0',
          'name',
          'version',
          'dist-tags[latest]',
          '--json',
          '--registry=https://registry.npmjs.org/',
        ],
        expect.anything()
      );
      expect(mockExec).not.toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['versions']),
        expect.anything()
      );
      expect(mockExec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['dist-tag', 'add']),
        expect.anything()
      );
    });

    it('skips publishing when the requested tag already points to the current version', async () => {
      mockExec.mockReturnValueOnce(
        JSON.stringify({
          name: '@scope/test-package',
          version: '1.0.0',
          'dist-tags[latest]': '1.0.0',
        })
      );

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      );
    });

    it('supports dotted dist-tags and array responses', async () => {
      mockParseRegistryOptions.mockResolvedValue({
        registry: 'https://registry.example.com/',
        tag: 'release.next',
        registryConfigKey: '@scope:registry',
      });
      mockExec
        .mockReturnValueOnce(
          JSON.stringify([
            {
              name: '@scope/test-package',
              version: '1.0.0+build.1',
              'dist-tags[release.next]': '0.9.0',
            },
            {
              name: '@scope/test-package',
              version: '1.0.0',
              'dist-tags[release.next]': '0.9.0',
            },
          ])
        )
        .mockReturnValueOnce('');

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenNthCalledWith(
        2,
        'npm',
        [
          'view',
          '@scope/test-package@1.0.0',
          'name',
          'version',
          'dist-tags[release.next]',
          '--json',
          '--@scope:registry=https://registry.example.com/',
        ],
        expect.anything()
      );
      expect(mockExec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['dist-tag', 'add']),
        expect.anything()
      );
    });

    it('publishes when npm reports the exact version is missing', async () => {
      mockExec
        .mockImplementationOnce(() => {
          throw npmViewNotFoundError();
        })
        .mockReturnValueOnce('{}');

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.anything()
      );
    });

    it.each([
      ['non-404 registry error', 'E403', 'npm error 403 Not Found'],
      ['child process buffer error', 'ENOBUFS', 'npm error code E404'],
    ])('fails without publishing on %s', async (_name, code, stderr) => {
      mockExec.mockImplementationOnce(() => {
        const error: any = new Error('npm view failed');
        error.code = code;
        error.stdout = JSON.stringify({
          error: { code, summary: 'request failed' },
        });
        error.stderr = stderr;
        throw error;
      });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(mockExec).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['publish']),
        expect.anything()
      );
      expect(mockExec).not.toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['dist-tag', 'add']),
        expect.anything()
      );
    });

    it('fails without publishing when npm returns an unexpected response', async () => {
      mockExec.mockReturnValueOnce('{"name":"other-package"}');

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(mockExec).toHaveBeenCalledTimes(2);
    });
  });

  describe('npm dist-tag error handling', () => {
    it('returns failure and logs only the dist-tag add error when add fails with empty stdout', async () => {
      mockExec
        .mockReturnValueOnce(
          JSON.stringify({
            name: '@scope/test-package',
            version: '1.0.0',
            'dist-tags[latest]': '0.9.0',
          })
        )
        .mockImplementationOnce(() => {
          const error: any = new Error('npm dist-tag add failed');
          error.stdout = '';
          error.stderr = 'npm ERR! permission denied';
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

  describe('npm view empty output handling', () => {
    it('should continue to publish when npm view returns empty output instead of crashing on JSON.parse', async () => {
      // `npm view` can exit 0 with empty stdout when the package exists in the
      // registry but has no published versions/dist-tags yet (e.g. GitHub
      // Packages). Previously this crashed on `JSON.parse('')` and was reported
      // as "Something unexpected went wrong when checking for existing
      // dist-tags." See https://github.com/nrwl/nx/issues/36358
      mockExec
        .mockReturnValueOnce('') // npm view -> empty stdout
        .mockReturnValueOnce('{}'); // npm publish

      vi.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue({
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
      expect(console.error).not.toHaveBeenCalledWith(
        'Something unexpected went wrong when checking for existing dist-tags.\n',
        expect.anything()
      );
      // Should have proceeded with npm --version, npm view, and publish
      expect(mockExec).toHaveBeenCalledTimes(3);
    });
  });

  describe('npm availability check', () => {
    it('should continue without error when pm is bun and npm is not installed', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExec.mockReset();

      // npm --version throws (npm not installed)
      mockExec
        .mockImplementationOnce(() => {
          throw new Error('Command not found: npm');
        })
        // bun info call for view command
        .mockReturnValueOnce(
          JSON.stringify({
            versions: ['0.9.0'],
            'dist-tags': { latest: '0.9.0' },
          })
        )
        // bun publish call
        .mockReturnValueOnce('bun publish output');

      vi.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue(
        null
      );

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      // Verify the view command used bun info (not npm view)
      expect(mockExec).toHaveBeenCalledWith(
        'bun',
        expect.arrayContaining(['info']),
        expect.anything()
      );
      // Verify npm dist-tag add was NOT called (npm not installed)
      expect(mockExec).not.toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['dist-tag', 'add']),
        expect.anything()
      );
    });

    it('should fall back to npm publish when bun publish fails with an authentication error and npm is installed', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExec.mockReset();

      mockExec
        // npm --version succeeds (npm is installed)
        .mockReturnValueOnce('11.5.1')
        // bun info (view) call
        .mockReturnValueOnce(
          JSON.stringify({
            versions: ['0.9.0'],
            'dist-tags': { latest: '0.9.0' },
          })
        )
        // bun publish fails with missing authentication
        .mockImplementationOnce(() => {
          const error: any = new Error('bun publish failed');
          error.stdout = '';
          error.stderr = 'error: missing authentication (run `bunx npm login`)';
          throw error;
        })
        // npm publish (fallback) succeeds
        .mockReturnValueOnce('{}');

      vi.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue({
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
      expect(mockExec).toHaveBeenCalledWith(
        'bun',
        expect.arrayContaining(['publish']),
        expect.anything()
      );
      // npm publish was tried after bun failed
      expect(mockExec).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.anything()
      );
      // the user-facing fallback warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('falling back to npm publish')
      );
    });

    it('should not fall back to npm publish when bun publish fails with a non-auth error', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExec.mockReset();

      mockExec
        // npm --version succeeds (npm is installed)
        .mockReturnValueOnce('11.5.1')
        // bun info (view) call
        .mockReturnValueOnce(
          JSON.stringify({
            versions: ['0.9.0'],
            'dist-tags': { latest: '0.9.0' },
          })
        )
        // bun publish fails with a non-auth error (e.g., version conflict)
        .mockImplementationOnce(() => {
          const error: any = new Error('bun publish failed');
          error.stdout = '';
          error.stderr = 'error: version 1.0.0 already exists in the registry';
          throw error;
        });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('bun publish error:');
      // npm publish must NOT be attempted for non-auth bun errors
      expect(mockExec).not.toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.anything()
      );
      // the fallback warning must NOT have been logged
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('falling back to npm publish')
      );
    });

    it('should not fall back to npm publish when bun publish fails with an authentication error but npm is not installed', async () => {
      mockDetectPackageManager.mockReturnValue('bun');
      mockExec.mockReset();

      mockExec
        // npm --version throws (npm not installed)
        .mockImplementationOnce(() => {
          throw new Error('Command not found: npm');
        })
        // bun info (view) call
        .mockReturnValueOnce(
          JSON.stringify({
            versions: ['0.9.0'],
            'dist-tags': { latest: '0.9.0' },
          })
        )
        // bun publish fails with an auth error — but npm is unavailable, so no fallback
        .mockImplementationOnce(() => {
          const error: any = new Error('bun publish failed');
          error.stdout = '';
          error.stderr = 'error: missing authentication (run `bunx npm login`)';
          throw error;
        });

      const result = await runExecutor(options, context);

      expect(result.success).toBe(false);
      expect(console.error).toHaveBeenCalledWith('bun publish error:');
      // npm publish must NOT be attempted when npm is unavailable
      expect(mockExec).not.toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.anything()
      );
    });

    it('should return failure when pm is not bun and npm is not installed', async () => {
      mockDetectPackageManager.mockReturnValue('pnpm');
      mockExec.mockReset();

      // npm --version throws (npm not installed)
      mockExec.mockImplementationOnce(() => {
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

  describe('untrusted values reaching the child process', () => {
    // `tag` and `registry` come back from `npm config get`, i.e. verbatim from
    // a workspace .npmrc an install script can write.
    const TAG_PAYLOAD = 'latest; touch NX_PWNED';
    const REGISTRY_PAYLOAD = 'https://r.example.com/"; touch NX_PWNED; "';

    function argvFor(binary: string, subcommand: string): string[] | undefined {
      return mockExec.mock.calls.find(
        ([command, args]) => command === binary && args?.[0] === subcommand
      )?.[1] as string[] | undefined;
    }

    it('should pass an injected tag and registry to publish as single argv elements', async () => {
      mockParseRegistryOptions.mockResolvedValue({
        registry: REGISTRY_PAYLOAD,
        tag: TAG_PAYLOAD,
        registryConfigKey: 'registry',
      });
      mockExec
        .mockImplementationOnce(() => {
          throw npmViewNotFoundError();
        }) // npm view: version not published yet
        .mockReturnValueOnce('{}'); // npm publish
      vi.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue(
        null
      );

      await runExecutor(options, context);

      const publishArgs = argvFor('npm', 'publish');
      expect(publishArgs).toContain(`--tag=${TAG_PAYLOAD}`);
      expect(publishArgs).toContain(`--registry=${REGISTRY_PAYLOAD}`);
    });

    it('should pass an injected tag to npm dist-tag add as a single argv element', async () => {
      mockParseRegistryOptions.mockResolvedValue({
        registry: REGISTRY_PAYLOAD,
        tag: TAG_PAYLOAD,
        registryConfigKey: 'registry',
      });
      mockExec
        .mockReturnValueOnce(
          JSON.stringify({
            name: '@scope/test-package',
            version: '1.0.0',
            [`dist-tags[${TAG_PAYLOAD}]`]: '0.9.0',
          })
        ) // npm view: the version already exists, so the dist-tag path runs
        .mockReturnValueOnce(''); // npm dist-tag add

      const result = await runExecutor(options, context);

      expect(result.success).toBe(true);
      const distTagArgs = argvFor('npm', 'dist-tag');
      expect(distTagArgs).toContain(TAG_PAYLOAD);
      expect(distTagArgs).toContain(`--registry=${REGISTRY_PAYLOAD}`);
    });

    it('should pass otp and access through as single argv elements', async () => {
      mockExec
        .mockImplementationOnce(() => {
          throw npmViewNotFoundError();
        }) // npm view: version not published yet
        .mockReturnValueOnce('{}'); // npm publish
      vi.spyOn(extractModule, 'extractNpmPublishJsonData').mockReturnValue(
        null
      );

      await runExecutor(
        {
          ...options,
          otp: '123456; touch NX_PWNED' as any,
          access: 'public evil' as any,
        },
        context
      );

      const publishArgs = argvFor('npm', 'publish');
      expect(publishArgs).toContain('--otp=123456; touch NX_PWNED');
      expect(publishArgs).toContain('--access=public evil');
    });
  });
});
