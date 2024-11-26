import 'nx/src/internal-testing-utils/mock-project-graph';

import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Builders } from '@schematics/angular/utility/workspace-models';
import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import { generateTestApplication } from '../../generators/utils/testing';
import updateWorkspaceConfig from './update-workspace-config';

describe(`Migration to remove bundleDependencies`, () => {
  it(`should remove 'bundleDependencies'`, async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
    await generateTestApplication(tree, {
      directory: 'test',
      skipFormat: true,
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
