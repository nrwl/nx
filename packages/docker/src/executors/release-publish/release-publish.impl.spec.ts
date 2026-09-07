import type { ExecutorContext } from '@nx/devkit';
import dockerReleasePublish from './release-publish.impl';

describe('docker release-publish executor', () => {
  it('skips publishing when release version data indicates no Docker version', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation();
    const context = {
      projectName: 'my-app',
      projectGraph: {
        nodes: {
          'my-app': {
            name: 'my-app',
            type: 'app',
            data: { root: 'apps/my-app' },
          },
        },
      },
    } as ExecutorContext;

    await expect(
      dockerReleasePublish(
        {
          nxReleaseVersionData: {
            'my-app': {
              currentVersion: '1.0.0',
              newVersion: null,
              dockerVersion: null,
            },
          },
        },
        context
      )
    ).resolves.toEqual({ success: true });
    expect(warn).toHaveBeenCalledWith(
      'Skipped Docker image for project "my-app", because no new Docker version was resolved for this project.'
    );
  });
});
