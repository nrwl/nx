import { handleDockerVersion } from './version-utils';
import { prompt } from 'enquirer';

/** Minimal mock objects to satisfy types without importing full release graph machinery */
const mockProjectNode: any = { name: 'my-app', data: { root: 'apps/my-app' } };
const versionActionsVersion = '1.2.3';

jest.mock('enquirer', () => ({
  prompt: jest.fn(),
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
    jest.mocked(prompt).mockResolvedValueOnce({ versionScheme: 'dev' });

    const { newVersion } = await handleDockerVersion(
      process.cwd(),
      mockProjectNode,
      finalConfigForProject,
      undefined,
      undefined,
      versionActionsVersion
    );

    expect(prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'versionScheme',
        type: 'select',
        choices: expect.arrayContaining([
          expect.objectContaining({ name: 'prod' }),
          expect.objectContaining({ name: 'dev' }),
        ]),
      })
    );
    expect(newVersion).toBe('my-app-0.0.0');
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
