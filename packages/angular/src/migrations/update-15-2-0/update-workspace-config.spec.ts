import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import applicationGenerator from '../../generators/application/application';
import updateWorkspaceConfig from './update-workspace-config';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import { Builders } from '@schematics/angular/utility/workspace-models';

describe(`Migration to remove bundleDependencies`, () => {
  it(`should remove 'bundleDependencies'`, async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await applicationGenerator(tree, {
      name: 'test',
    });

    const project = readProjectConfiguration(tree, 'test');
    project.targets.server = {
      executor: Builders.Server,
      options: {
        main: './server.ts',
        bundleDependencies: false,
        sourceMaps: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      configurations: {
        one: {
          aot: true,
        },
        two: {
          bundleDependencies: true,
          aot: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };
    updateProjectConfiguration(tree, 'test', project);

    await updateWorkspaceConfig(tree);

    const updatedProject = readProjectConfiguration(tree, 'test');
    const { options, configurations } = updatedProject.targets.server;

    expect(options.bundleDependencies).toBeUndefined();
    expect(configurations).toBeDefined();
    expect(configurations?.one.bundleDependencies).toBeUndefined();
    expect(configurations?.two.bundleDependencies).toBeUndefined();
  });
});
