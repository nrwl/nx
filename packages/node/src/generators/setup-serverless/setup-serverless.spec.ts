import { applicationGenerator } from '../application/application';
import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { setupServerlessGenerator } from './setup-serverless';
describe('setupServerlessGenerator', () => {
  let tree: Tree;

  beforeEach(() => (tree = createTreeWithEmptyWorkspace()));

  describe('integrated', () => {
    it('should create a netlify platform specific asset which is used to deploy', async () => {
      await applicationGenerator(tree, {
        name: 'api',
        framework: 'express',
        e2eTestRunner: 'none',
        docker: false,
      });
      await setupServerlessGenerator(tree, {
        project: 'api',
        platform: 'netlify',
      });

      const project = readProjectConfiguration(tree, 'api');
      expect(tree.exists('netlify.toml'));
      expect(project.targets).toEqual(
        expect.objectContaining({
          deploy: {
            dependsOn: ['build'],
            command: 'npx netlify deploy --site api',
            configurations: {
              production: {
                command: 'npx netlify deploy --site api --prod-if-unlocked',
              },
            },
          },
        })
      );
    });
  });

  describe('standalone', () => {
    it('should create a netlify platform specific asset which is used to deploy', async () => {
      await applicationGenerator(tree, {
        name: 'api',
        framework: 'express',
        rootProject: true,
        docker: true,
      });

      await setupServerlessGenerator(tree, {
        project: 'api',
        platform: 'netlify',
      });

      const project = readProjectConfiguration(tree, 'api');
      expect(tree.exists('netlify.toml'));
      expect(project.targets).toEqual(
        expect.objectContaining({
          deploy: {
            dependsOn: ['build'],
            command: 'npx netlify deploy --site api',
            configurations: {
              production: {
                command: 'npx netlify deploy --site api --prod-if-unlocked',
              },
            },
          },
        })
      );
    });
  });
});
