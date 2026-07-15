import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import configurationGenerator from './generator';

describe('configurationGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: { build: { executor: '@nx/js:tsc' } },
    });
  });

  it('adds a container target using @nx/docker:build with the default name', async () => {
    await configurationGenerator(tree, { project: 'app' });

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.container).toEqual({
      executor: '@nx/docker:build',
      dependsOn: ['build'],
      options: {
        engine: 'docker',
        load: true,
        metadata: {
          images: ['app'],
          tags: [
            'type=schedule',
            'type=ref,event=branch',
            'type=ref,event=tag',
            'type=ref,event=pr',
            'type=sha,prefix=sha-',
          ],
        },
      },
    });
  });

  it('respects a custom targetName', async () => {
    await configurationGenerator(tree, {
      project: 'app',
      targetName: 'docker-build',
    });

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets['docker-build']).toBeDefined();
    expect(project.targets.container).toBeUndefined();
  });

  it('respects the podman engine option', async () => {
    await configurationGenerator(tree, { project: 'app', engine: 'podman' });

    const project = readProjectConfiguration(tree, 'app');
    expect(project.targets.container.options.engine).toEqual('podman');
  });

  it('throws when the target already exists', async () => {
    addProjectConfiguration(tree, 'taken', {
      root: 'apps/taken',
      targets: { container: { executor: 'nx:run-commands' } },
    });

    await expect(
      configurationGenerator(tree, { project: 'taken' })
    ).rejects.toThrow(/already exists/);
  });

  it('scaffolds an empty Dockerfile by default when none exists', async () => {
    await configurationGenerator(tree, { project: 'app' });
    expect(tree.exists('apps/app/Dockerfile')).toBe(true);
  });

  it('scaffolds the requested template with projectName interpolated', async () => {
    await configurationGenerator(tree, { project: 'app', template: 'nginx' });
    const content = tree.read('apps/app/Dockerfile', 'utf-8');
    expect(content).toContain('dist/apps/app/*');
  });

  it('does not overwrite an existing Dockerfile', async () => {
    tree.write('apps/app/Dockerfile', 'FROM scratch\n');
    await configurationGenerator(tree, { project: 'app', template: 'nginx' });
    expect(tree.read('apps/app/Dockerfile', 'utf-8')).toEqual('FROM scratch\n');
  });
});
