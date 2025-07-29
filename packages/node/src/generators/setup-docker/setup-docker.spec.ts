import { readNxJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from '../application/application';
import { setupDockerGenerator } from './setup-docker';

describe('setupDockerGenerator', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    jest.resetModules();
  });

  describe('integrated', () => {
    it('should create docker assets when --docker is passed', async () => {
      const projectName = 'integreated-api';

      await applicationGenerator(tree, {
        directory: projectName,
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);

      const dockerFile = tree.read(`${projectName}/Dockerfile`, 'utf8');
      expect(tree.exists(`${projectName}/Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist/${projectName} ${projectName}/`);
      expect(project.targets).toEqual(
        expect.objectContaining({
          'docker:build': {
            dependsOn: ['build', 'prune'],
          },
        })
      );
      expect(readNxJson(tree)).toEqual(
        expect.objectContaining({
          plugins: expect.arrayContaining([
            {
              plugin: '@nx/docker',
              options: { buildTarget: 'docker:build', runTarget: 'docker:run' },
            },
          ]),
        })
      );
    });
  });

  describe('standalone', () => {
    it('should create docker assets when --docker is passed', async () => {
      const projectName = 'standalone-api';

      await applicationGenerator(tree, {
        name: projectName,
        directory: '.',
        framework: 'fastify',
        docker: true,
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);
      const dockerFile = tree.read(`Dockerfile`, 'utf8');

      expect(tree.exists(`Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist/${projectName} ${projectName}/`);
      expect(project.targets).toEqual(
        expect.objectContaining({
          'docker:build': {
            dependsOn: ['build', 'prune'],
          },
        })
      );
    });
  });
});
