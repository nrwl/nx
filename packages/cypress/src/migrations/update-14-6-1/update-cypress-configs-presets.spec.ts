import { updateCypressConfigsPresets } from './update-cypress-configs-presets';
import { installedCypressVersion } from '../../utils/cypress-version';
import {
  addProjectConfiguration,
  DependencyType,
  logger,
  ProjectGraph,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { cypressProjectGenerator } from '../../generators/cypress-project/cypress-project';
import { libraryGenerator } from '@nx/js';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => {
  return {
    ...jest.requireActual('@nx/devkit'),
    createProjectGraphAsync: jest.fn().mockImplementation(() => projectGraph),
    readTargetOptions: jest.fn().mockImplementation(() => ({})),
  };
});
jest.mock('../../utils/cypress-version');
describe('updateComponentTestingConfig', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });
  it('should update', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    await setup(tree, { name: 'something' });
    await updateCypressConfigsPresets(tree);
    expect(
      tree.read('libs/something-lib/cypress.config.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );
    expect(
      tree.read('libs/something-lib/cypress.config-two.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__filename, { ctTargetName: 'ct' }),
});
`
    );

    expect(tree.read('apps/something-e2e/cypress.config.ts', 'utf-8'))
      .toContain(`export default defineConfig({
  e2e: nxE2EPreset(__filename),
});
`);
    expect(tree.read('apps/something-e2e/cypress.storybook-config.ts', 'utf-8'))
      .toContain(`export default defineConfig({
  e2e: nxE2EStorybookPreset(__filename),
});
`);
    const libProjectConfig = readProjectConfiguration(tree, 'something-lib');
    expect(libProjectConfig.targets['component-test']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/something-lib/cypress.config.ts',
        testingType: 'component',
        devServerTarget: 'something-app:build',
        skipServe: true,
      },
    });
    expect(libProjectConfig.targets['ct']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/something-lib/cypress.config-two.ts',
        testingType: 'component',
        devServerTarget: 'something-app:build',
        skipServe: true,
      },
      configurations: {
        prod: {
          baseUrl: 'https://example.com',
        },
      },
    });
  });

  it('should list out projects when unable to update config', async () => {
    const loggerSpy = jest.spyOn(logger, 'warn');
    await setup(tree, { name: 'something' });
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
    await updateCypressConfigsPresets(tree);

    expect(loggerSpy.mock.calls).toEqual([
      [
        'Unable to find a build target to add to the component testing target in the following projects:',
      ],
      ['- something-lib'],
      [
        `You can manually add the 'devServerTarget' option to the
component testing target to specify the build target to use.
The build configuration should be using @nrwl/web:webpack as the executor.
Usually this is a React app in your workspace.
Component testing will fallback to a default configuration if one isn't provided,
but might require modifications if your projects are more complex.`,
      ],
    ]);
  });

  it('should handle already updated config', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    await setup(tree, { name: 'something' });

    expect(async () => {
      await updateCypressConfigsPresets(tree);
    }).not.toThrow();
    expect(tree.read('libs/something-lib/cypress.config.ts', 'utf-8'))
      .toContain(`export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`);
    expect(
      tree.read('libs/something-lib/cypress.config-two.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__filename, { ctTargetName: 'ct' }),
});
`
    );

    expect(tree.read('apps/something-e2e/cypress.config.ts', 'utf-8'))
      .toContain(`export default defineConfig({
  e2e: nxE2EPreset(__filename),
});
`);
  });
  it('should not update if using < v10', async () => {
    mockedInstalledCypressVersion.mockReturnValue(9);
    await setup(tree, { name: 'something' });
    await updateCypressConfigsPresets(tree);
    expect(
      tree.read('libs/something-lib/cypress.config.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__dirname),
});
`
    );
    expect(
      tree.read('libs/something-lib/cypress.config-two.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__dirname),
});
`
    );

    expect(tree.read('apps/something-e2e/cypress.config.ts', 'utf-8'))
      .toContain(`export default defineConfig({
  e2e: nxE2EPreset(__dirname),
});
`);
  });

  it('should be idempotent', async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    await setup(tree, { name: 'something' });
    await updateCypressConfigsPresets(tree);
    expect(
      tree.read('libs/something-lib/cypress.config.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );
    expect(
      tree.read('libs/something-lib/cypress.config-two.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__filename, { ctTargetName: 'ct' }),
});
`
    );

    expect(tree.read('apps/something-e2e/cypress.config.ts', 'utf-8'))
      .toContain(`export default defineConfig({
  e2e: nxE2EPreset(__filename),
});
`);
    const libProjectConfig = readProjectConfiguration(tree, 'something-lib');
    expect(libProjectConfig.targets['component-test']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/something-lib/cypress.config.ts',
        testingType: 'component',
        devServerTarget: 'something-app:build',
        skipServe: true,
      },
    });
    expect(libProjectConfig.targets['ct']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/something-lib/cypress.config-two.ts',
        testingType: 'component',
        devServerTarget: 'something-app:build',
        skipServe: true,
      },
      configurations: {
        prod: {
          baseUrl: 'https://example.com',
        },
      },
    });

    await updateCypressConfigsPresets(tree);
    expect(
      tree.read('libs/something-lib/cypress.config.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
`
    );
    expect(
      tree.read('libs/something-lib/cypress.config-two.ts', 'utf-8')
    ).toContain(
      `export default defineConfig({
  component: nxComponentTestingPreset(__filename, { ctTargetName: 'ct' }),
});
`
    );

    expect(tree.read('apps/something-e2e/cypress.config.ts', 'utf-8'))
      .toContain(`export default defineConfig({
  e2e: nxE2EPreset(__filename),
});
`);
    const libProjectConfig2 = readProjectConfiguration(tree, 'something-lib');
    expect(libProjectConfig2.targets['component-test']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/something-lib/cypress.config.ts',
        testingType: 'component',
        devServerTarget: 'something-app:build',
        skipServe: true,
      },
    });
    expect(libProjectConfig2.targets['ct']).toEqual({
      executor: '@nrwl/cypress:cypress',
      options: {
        cypressConfig: 'libs/something-lib/cypress.config-two.ts',
        testingType: 'component',
        devServerTarget: 'something-app:build',
        skipServe: true,
      },
      configurations: {
        prod: {
          baseUrl: 'https://example.com',
        },
      },
    });
  });
});

async function setup(tree: Tree, options: { name: string }) {
  const appName = `${options.name}-app`;
  const libName = `${options.name}-lib`;
  const e2eName = `${options.name}-e2e`;
  tree.write(
    'apps/my-app/cypress.config.ts',
    `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nrwl/cypress/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__dirname),
});
`
  );

  addProjectConfiguration(tree, appName, {
    root: `apps/my-app`,
    sourceRoot: `apps/${appName}/src`,
    targets: {
      build: {
        executor: '@nrwl/web:webpack',
        outputs: ['{options.outputPath}'],
        options: {
          compiler: 'babel',
          outputPath: `dist/apps/${appName}`,
          index: `apps/${appName}/src/index.html`,
          baseHref: '/',
          main: `apps/${appName}/src/main.tsx`,
          polyfills: `apps/${appName}/src/polyfills.ts`,
          tsConfig: `apps/${appName}/tsconfig.app.json`,
        },
      },
    },
  });
  await cypressProjectGenerator(tree, { project: appName, name: e2eName });
  const e2eProjectConfig = readProjectConfiguration(tree, e2eName);
  e2eProjectConfig.targets['e2e'] = {
    ...e2eProjectConfig.targets['e2e'],
    executor: '@nrwl/cypress:cypress',
  };
  e2eProjectConfig.targets['e2e'].configurations = {
    ...e2eProjectConfig.targets['e2e'].configurations,
    sb: {
      cypressConfig: `apps/${e2eName}/cypress.storybook-config.ts`,
    },
  };
  updateProjectConfiguration(tree, e2eName, e2eProjectConfig);
  tree.write(
    `apps/${e2eName}/cypress.config.ts`,
    `import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: nxE2EPreset(__dirname),
});
`
  );
  tree.write(
    `apps/${e2eName}/cypress.storybook-config.ts`,
    `
  import { defineConfig } from 'cypress';
import { nxE2EStorybookPreset } from '@nrwl/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: nxE2EStorybookPreset(__dirname),
});
`
  );
  // lib
  await libraryGenerator(tree, { name: libName });
  const libProjectConfig = readProjectConfiguration(tree, libName);
  libProjectConfig.targets = {
    ...libProjectConfig.targets,
    'component-test': {
      executor: '@nrwl/cypress:cypress',
      options: {
        testingType: 'component',
        cypressConfig: `libs/${libName}/cypress.config.ts`,
      },
    },
    ct: {
      executor: '@nrwl/cypress:cypress',
      options: {
        testingType: 'component',
        cypressConfig: `libs/${libName}/cypress.config-two.ts`,
      },
      configurations: {
        prod: {
          baseUrl: 'https://example.com',
        },
      },
    },
  };
  updateProjectConfiguration(tree, libName, libProjectConfig);
  tree.write(
    `libs/${libName}/cypress.config.ts`,
    `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nrwl/cypress/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__dirname),
});
`
  );
  tree.write(
    `libs/${libName}/cypress.config-two.ts`,
    `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nrwl/cypress/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__dirname),
});
`
  );

  projectGraph = {
    nodes: {
      [appName]: {
        name: appName,
        type: 'app',
        data: {
          ...readProjectConfiguration(tree, appName),
        },
      },
      [e2eName]: {
        name: e2eName,
        type: 'e2e',
        data: {
          ...readProjectConfiguration(tree, e2eName),
        },
      },
      [libName]: {
        name: libName,
        type: 'lib',
        data: {
          ...readProjectConfiguration(tree, libName),
        },
      },
    } as any,
    dependencies: {
      [appName]: [
        { type: DependencyType.static, source: appName, target: libName },
      ],
      [e2eName]: [
        { type: DependencyType.implicit, source: e2eName, target: libName },
      ],
    },
  };
}
