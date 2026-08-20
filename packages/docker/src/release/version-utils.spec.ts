import { handleDockerVersion } from './version-utils';
import { selectPrompt } from '@nx/devkit/internal';

/** Minimal mock objects to satisfy types without importing full release graph machinery */
const mockProjectNode: any = { name: 'my-app', data: { root: 'apps/my-app' } };
const versionActionsVersion = '1.2.3';

jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  selectPrompt: jest.fn(),
}));

describe('handleDockerVersion {versionActionsVersion} integration', () => {
  beforeEach(() => {
    process.env.NX_DRY_RUN = 'true';
    delete process.env.NX_DOCKER_IMAGE_REF;
  });

  it('interpolates {versionActionsVersion} within selected version scheme', async () => {
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: undefined,
        versionSchemes: { prod: '{projectName}-{versionActionsVersion}' },
      },
    };

    const { newVersion } = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      'prod',
      undefined,
      versionActionsVersion
    );

    expect(newVersion).toBe('my-app-1.2.3');
  });

  it('uses explicit dockerVersion when provided (bypassing scheme interpolation)', async () => {
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: undefined,
        versionSchemes: { prod: '{projectName}-{versionActionsVersion}' },
      },
    };

    const { newVersion } = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      undefined,
      'explicit-version',
      versionActionsVersion
    );

    expect(newVersion).toBe('explicit-version');
  });

  it('automatically picks the only available version scheme', async () => {
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: undefined,
        versionSchemes: { prod: '{projectName}-{versionActionsVersion}' },
      },
    };

    const { newVersion } = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      undefined,
      undefined,
      versionActionsVersion
    );

    expect(newVersion).toBe('my-app-1.2.3');
  });

  it('skips a project when the selected scheme requires a missing version actions version', async () => {
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: undefined,
        versionSchemes: { prod: '{versionActionsVersion}' },
      },
    };

    const result = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      'prod'
    );

    expect(result).toEqual({
      newVersion: null,
      logs: [
        'Skipped my-app, because no new version was resolved for this project.',
      ],
    });
  });

  it('still versions a project when its scheme does not require a version actions version', async () => {
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: undefined,
        versionSchemes: { prod: '{projectName}-latest' },
      },
    };

    const { newVersion } = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      'prod'
    );

    expect(newVersion).toBe('my-app-latest');
  });

  it('prompts for version scheme when multiple are available', async () => {
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: undefined,
        versionSchemes: {
          prod: '{projectName}-{versionActionsVersion}',
          dev: '{projectName}-0.0.0',
        },
      },
    };

    // Mock prompt to return 'dev' scheme
    jest.mocked(selectPrompt).mockResolvedValueOnce('dev');

    const { newVersion } = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      undefined,
      undefined,
      versionActionsVersion
    );

    expect(selectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'prod' }),
          expect.objectContaining({ value: 'dev' }),
        ]),
      })
    );
    expect(newVersion).toBe('my-app-0.0.0');
  });

  it("carries each scheme's resolved pattern as its own hint", async () => {
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: undefined,
        versionSchemes: {
          prod: '{projectName}-{versionActionsVersion}',
          dev: '{projectName}-0.0.0',
        },
      },
    };
    jest.mocked(selectPrompt).mockResolvedValueOnce('dev');

    await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      undefined,
      undefined,
      versionActionsVersion
    );

    const call = jest.mocked(selectPrompt).mock.calls[0][0] as any;
    // The hint interpolates the project name only, matching what the scheme
    // list can resolve before a version is chosen.
    const devChoice = call.choices.find((c: any) => c.value === 'dev');
    expect(devChoice.hint).toBe('my-app-0.0.0');
    expect(call.choices.every((c: any) => !!c.hint)).toBe(true);
  });

  it('falls back to env NX_DOCKER_IMAGE_REF tag if provided (extracting version)', async () => {
    process.env.NX_DOCKER_IMAGE_REF = 'registry.example.com/repo:9.9.9';
    const finalConfigForProject: any = {
      dockerOptions: {
        repositoryName: 'repo',
        registryUrl: 'registry.example.com',
        versionSchemes: { prod: '{projectName}-{versionActionsVersion}' },
      },
    };

    const { newVersion } = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      'prod',
      undefined,
      versionActionsVersion
    );

    expect(newVersion).toBe('9.9.9');
  });
});
