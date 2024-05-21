import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

describe('setupDockerGenerator', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    jest.resetModules();
  });

  describe('integrated', () => {
    it('should create docker assets when --docker is passed', async () => {
      const projectName = 'integreated-api';
      // Since we mock the project graph, we need to mock the project configuration as well
      mockReadCachedProjectConfiguration({
        name: projectName,
        root: projectName,
      });

      const { applicationGenerator } = await import(
        '../application/application'
      );

      await applicationGenerator(tree, {
        name: projectName,
        framework: 'express',
        e2eTestRunner: 'none',
        docker: true,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);

      const dockerFile = tree.read(`${projectName}/Dockerfile`, 'utf8');
      expect(tree.exists(`${projectName}/Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist/${projectName} ${projectName}/`);
      expect(project.targets).toEqual(
        expect.objectContaining({
          'docker-build': {
            dependsOn: ['build'],
            command: `docker build -f ${projectName}/Dockerfile . -t ${projectName}`,
          },
        })
      );
    });
  });

  describe('standalone', () => {
    it('should create docker assets when --docker is passed', async () => {
      const projectName = 'standalone-api';
      mockReadCachedProjectConfiguration({ name: projectName, root: '' });

      const { applicationGenerator } = await import(
        '../application/application'
      );
      await applicationGenerator(tree, {
        name: projectName,
        framework: 'fastify',
        rootProject: true,
        docker: true,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      const project = readProjectConfiguration(tree, projectName);
      const dockerFile = tree.read(`Dockerfile`, 'utf8');

      expect(tree.exists(`Dockerfile`)).toBeTruthy();
      expect(dockerFile).toContain(`COPY dist/${projectName} ${projectName}/`);
      expect(project.targets).toEqual(
        expect.objectContaining({
          'docker-build': {
            dependsOn: ['build'],
            command: `docker build -f Dockerfile . -t ${projectName}`,
          },
        })
      );
    });
  });
});

const mockReadCachedProjectConfiguration = (
  projectConfig: ProjectConfiguration
) => {
  jest.mock('nx/src/project-graph/project-graph', () => {
    return {
      ...jest.requireActual('nx/src/project-graph/project-graph'),
      readCachedProjectConfiguration: jest.fn(() => {
        return {
          root: projectConfig.root,
          targets: {
            build: {
              outputs: [`dist/${projectConfig.name}`],
            },
          },
        };
      }),
    };
  });
};
