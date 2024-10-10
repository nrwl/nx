import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  DependencyType,
  joinPathFragments,
  ProjectGraph,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

let projectGraph: ProjectGraph = { nodes: {}, dependencies: {} };
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

import { componentGenerator } from '../component/component';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { generateTestApplication, generateTestLibrary } from '../utils/testing';
import { cypressComponentConfiguration } from './cypress-component-configuration';

jest.mock('@nx/cypress/src/utils/cypress-version');
// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  readCachedProjectGraph: jest.fn().mockImplementation(() => projectGraph),
}));

describe('Cypress Component Testing Configuration', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  // TODO(@leosvelperez): Turn this to adding the plugin

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('.gitignore', '');
    mockedInstalledCypressVersion.mockReturnValue(10);

    projectGraph = {
      dependencies: {},
      nodes: {},
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateProjectConfig', () => {
    it('should add project config with --target=<project>:<target>', async () => {
      await generateTestApplication(tree, {
        directory: 'fancy-app',
        skipFormat: true,
      });
      await generateTestLibrary(tree, {
        directory: 'fancy-lib',
        skipFormat: true,
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        path: 'fancy-lib/src/lib/fancy-cmp/fancy-cmp',
        export: true,
        skipFormat: true,
      });
      projectGraph = {
        nodes: {
          'fancy-app': {
            name: 'fancy-app',
            type: 'app',
            data: {
              ...readProjectConfiguration(tree, 'fancy-app'),
            },
          },
          'fancy-lib': {
            name: 'fancy-lib',
            type: 'lib',
            data: {
              ...readProjectConfiguration(tree, 'fancy-lib'),
            },
          },
        } as any,
        dependencies: {
          'fancy-app': [
            {
              type: DependencyType.static,
              source: 'fancy-app',
              target: 'fancy-lib',
            },
          ],
        },
      };

      await cypressComponentConfiguration(tree, {
        project: 'fancy-lib',
        buildTarget: 'fancy-app:build',
        generateTests: false,
        skipFormat: true,
      });

      expect(
        tree.exists('fancy-lib/src/lib/fancy-cmp/fancy-cmp.component.cy.ts')
      ).toBeFalsy();
      expect(
        readProjectConfiguration(tree, 'fancy-lib').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'fancy-lib/cypress.config.ts',
          devServerTarget: 'fancy-app:build',
          skipServe: true,
          testingType: 'component',
        },
      });
    });

    it('should add project config with --target=<project>:<target>:<config>', async () => {
      await generateTestApplication(tree, {
        directory: 'fancy-app',
        skipFormat: true,
      });
      await generateTestLibrary(tree, {
        directory: 'fancy-lib',
        skipFormat: true,
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        path: 'fancy-lib/src/lib/fancy-cmp/fancy-cmp',
        export: true,
        skipFormat: true,
      });
      projectGraph = {
        nodes: {
          'fancy-app': {
            name: 'fancy-app',
            type: 'app',
            data: {
              ...readProjectConfiguration(tree, 'fancy-app'),
            },
          } as any,
          'fancy-lib': {
            name: 'fancy-lib',
            type: 'lib',
            data: {
              ...readProjectConfiguration(tree, 'fancy-lib'),
            } as any,
          },
        },
        dependencies: {
          'fancy-app': [
            {
              type: DependencyType.static,
              source: 'fancy-app',
              target: 'fancy-lib',
            },
          ],
        },
      };

      await cypressComponentConfiguration(tree, {
        project: 'fancy-lib',
        buildTarget: 'fancy-app:build:development',
        generateTests: false,
        skipFormat: true,
      });

      expect(
        tree.exists('fancy-lib/src/lib/fancy-cmp/fancy-cmp.component.cy.ts')
      ).toBeFalsy();
      expect(
        readProjectConfiguration(tree, 'fancy-lib').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'fancy-lib/cypress.config.ts',
          devServerTarget: 'fancy-app:build:development',
          skipServe: true,
          testingType: 'component',
        },
      });
    });

    it('should not throw with invalid --build-target', async () => {
      await generateTestApplication(tree, {
        directory: 'fancy-app',
        skipFormat: true,
      });
      await generateTestLibrary(tree, {
        directory: 'fancy-lib',
        skipFormat: true,
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        path: 'fancy-lib/src/lib/fancy-cmp/fancy-cmp/',
        export: true,
        skipFormat: true,
      });

      jest.clearAllMocks();

      const appConfig = readProjectConfiguration(tree, 'fancy-app');
      appConfig.targets['build'].executor = 'something/else';
      updateProjectConfiguration(tree, 'fancy-app', appConfig);
      projectGraph = {
        nodes: {
          'fancy-app': {
            name: 'fancy-app',
            type: 'app',
            data: {
              ...appConfig,
            } as any,
          },
          'fancy-lib': {
            name: 'fancy-lib',
            type: 'lib',
            data: {
              ...readProjectConfiguration(tree, 'fancy-lib'),
            } as any,
          },
        },
        dependencies: {
          'fancy-app': [
            {
              type: DependencyType.static,
              source: 'fancy-app',
              target: 'fancy-lib',
            },
          ],
        },
      };

      await expect(async () => {
        await cypressComponentConfiguration(tree, {
          project: 'fancy-lib',
          buildTarget: 'fancy-app:build',
          generateTests: false,
          skipFormat: true,
        });
      }).resolves;
    });

    it('should use own project config', async () => {
      await generateTestApplication(tree, {
        directory: 'fancy-app',
        bundler: 'webpack',
        skipFormat: true,
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        path: 'fancy-app/src/lib/fancy-cmp/fancy-cmp',
        export: true,
        skipFormat: true,
      });
      projectGraph = {
        nodes: {
          'fancy-app': {
            name: 'fancy-app',
            type: 'app',
            data: {
              ...readProjectConfiguration(tree, 'fancy-app'),
            } as any,
          },
        },
        dependencies: {},
      };

      await cypressComponentConfiguration(tree, {
        project: 'fancy-app',
        generateTests: false,
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, 'fancy-app').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'fancy-app/cypress.config.ts',
          devServerTarget: 'fancy-app:build',
          skipServe: true,
          testingType: 'component',
        },
      });
    });

    it('should use the project graph to find the correct project config', async () => {
      await generateTestApplication(tree, {
        directory: 'fancy-app',
        bundler: 'webpack',
        skipFormat: true,
      });
      await generateTestLibrary(tree, {
        directory: 'fancy-lib',
        skipFormat: true,
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        path: 'fancy-app/src/app/fancy-lib/fancy-lib',
        export: true,
        skipFormat: true,
      });
      tree.write(
        'fancy-app/src/app/blah.component.ts',
        `import {FancyCmpComponent} from '@something/fancy-lib'`
      );
      projectGraph = {
        nodes: {
          'fancy-app': {
            name: 'fancy-app',
            type: 'app',
            data: {
              ...readProjectConfiguration(tree, 'fancy-app'),
            } as any,
          },
          'fancy-lib': {
            name: 'fancy-lib',
            type: 'lib',
            data: {
              ...readProjectConfiguration(tree, 'fancy-lib'),
            } as any,
          },
        },
        dependencies: {
          'fancy-app': [
            {
              type: DependencyType.static,
              source: 'fancy-app',
              target: 'fancy-lib',
            },
          ],
        },
      };

      await cypressComponentConfiguration(tree, {
        project: 'fancy-lib',
        generateTests: false,
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, 'fancy-lib').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'fancy-lib/cypress.config.ts',
          devServerTarget: 'fancy-app:build',
          skipServe: true,
          testingType: 'component',
        },
      });
    });
  });

  it('should setup angular specific configs', async () => {
    await generateTestLibrary(tree, {
      directory: 'my-lib',
      skipFormat: true,
    });
    await setup(tree, {
      project: 'my-lib',
      name: 'something',
      standalone: false,
    });
    projectGraph = {
      nodes: {
        something: {
          name: 'something',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'something'),
          } as any,
        },
        'my-lib': {
          name: 'my-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'my-lib'),
          } as any,
        },
      },
      dependencies: {
        'my-lib': [
          {
            type: DependencyType.static,
            source: 'my-lib',
            target: 'something',
          },
        ],
      },
    };

    await cypressComponentConfiguration(tree, {
      project: 'my-lib',
      buildTarget: 'something:build',
      generateTests: true,
      skipFormat: true,
    });

    expect(tree.read('my-lib/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename)
      });
      "
    `);
    expect(
      tree.read('my-lib/cypress/support/component.ts', 'utf-8')
    ).toMatchSnapshot('component.ts');
  });

  it('should exclude Cypress-related files from tsconfig.editor.json for applications', async () => {
    await generateTestApplication(tree, {
      directory: 'fancy-app',
      bundler: 'webpack',
      skipFormat: true,
    });
    await componentGenerator(tree, {
      name: 'fancy-cmp',
      path: 'fancy-app/src/app/fancy-cmp/fancy-cmp',
      export: true,
      skipFormat: true,
    });
    projectGraph = {
      nodes: {
        'fancy-app': {
          name: 'fancy-app',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'fancy-app'),
          } as any,
        },
      },
      dependencies: {},
    };

    await cypressComponentConfiguration(tree, {
      project: 'fancy-app',
      generateTests: false,
      skipFormat: true,
    });

    const tsConfig = readJson(tree, 'fancy-app/tsconfig.editor.json');
    expect(tsConfig.exclude).toStrictEqual(
      expect.arrayContaining([
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ])
    );
  });

  it('should work with simple components', async () => {
    await generateTestLibrary(tree, {
      directory: 'my-lib',
      skipFormat: true,
    });
    await setup(tree, {
      project: 'my-lib',
      name: 'something',
      standalone: false,
    });
    projectGraph = {
      nodes: {
        something: {
          name: 'something',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'something'),
          } as any,
        },
        'my-lib': {
          name: 'my-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'my-lib'),
          } as any,
        },
      },
      dependencies: {
        'my-lib': [
          {
            type: DependencyType.static,
            source: 'my-lib',
            target: 'something',
          },
        ],
      },
    };

    await cypressComponentConfiguration(tree, {
      project: 'my-lib',
      buildTarget: 'something:build',
      generateTests: true,
      skipFormat: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'my-lib/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with standalone component', async () => {
    await generateTestLibrary(tree, {
      directory: 'my-lib-standalone',
      skipFormat: true,
    });
    await setup(tree, {
      project: 'my-lib-standalone',
      name: 'something',
      standalone: true,
    });
    projectGraph = {
      nodes: {
        something: {
          name: 'something',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'something'),
          } as any,
        },
        'my-lib-standalone': {
          name: 'my-lib-standalone',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'my-lib-standalone'),
          } as any,
        },
      },
      dependencies: {
        'my-lib-standalone': [
          {
            type: DependencyType.static,
            source: 'my-lib-standalone',
            target: 'something',
          },
        ],
      },
    };

    await cypressComponentConfiguration(tree, {
      project: 'my-lib-standalone',
      buildTarget: 'something:build',
      generateTests: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'my-lib-standalone/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with complex component', async () => {
    await generateTestLibrary(tree, {
      directory: 'with-inputs-cmp',
      skipFormat: true,
    });
    await setup(tree, {
      project: 'with-inputs-cmp',
      name: 'something',
      standalone: false,
      withInputs: true,
      basePath: 'with-inputs-cmp/src/lib',
    });
    projectGraph = {
      nodes: {
        something: {
          name: 'something',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'something'),
          } as any,
        },
        'with-inputs-cmp': {
          name: 'with-inputs-cmp',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'with-inputs-cmp'),
          } as any,
        },
      },
      dependencies: {
        'with-inputs-cmp': [
          {
            type: DependencyType.static,
            source: 'with-inputs-cmp',
            target: 'something',
          },
        ],
      },
    };

    await cypressComponentConfiguration(tree, {
      project: 'with-inputs-cmp',
      buildTarget: 'something:build',
      generateTests: true,
      skipFormat: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'with-inputs-cmp/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with complex standalone component', async () => {
    await generateTestLibrary(tree, {
      directory: 'with-inputs-standalone-cmp',
      skipFormat: true,
    });
    await setup(tree, {
      project: 'with-inputs-standalone-cmp',
      name: 'something',
      standalone: true,
      withInputs: true,
      basePath: 'with-inputs-standalone-cmp/src/lib',
    });
    projectGraph = {
      nodes: {
        something: {
          name: 'something',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'something'),
          } as any,
        },
        'with-inputs-standalone-cmp': {
          name: 'with-inputs-standalone-cmp',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'with-inputs-standalone-cmp'),
          } as any,
        },
      },
      dependencies: {
        'with-inputs-standalone-cmp': [
          {
            type: DependencyType.static,
            source: 'with-inputs-standalone-cmp',
            target: 'something',
          },
        ],
      },
    };

    await cypressComponentConfiguration(tree, {
      project: 'with-inputs-standalone-cmp',
      buildTarget: 'something:build',
      generateTests: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'with-inputs-standalone-cmp/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with secondary entry point libs', async () => {
    await generateTestApplication(tree, {
      directory: 'my-cool-app',
      skipFormat: true,
    });
    await generateTestLibrary(tree, {
      directory: 'secondary',
      buildable: true,
      skipFormat: true,
    });
    await librarySecondaryEntryPointGenerator(tree, {
      name: 'button',
      library: 'secondary',
      skipFormat: true,
    });
    await componentGenerator(tree, {
      name: 'fancy-button',
      path: 'secondary/src/lib/button/fancy-button',
      skipFormat: true,
    });
    await componentGenerator(tree, {
      name: 'standalone-fancy-button',
      path: 'secondary/src/lib/button/standalone-fancy-button',
      standalone: true,
      skipFormat: true,
    });
    projectGraph = {
      nodes: {
        'my-cool-app': {
          name: 'my-cool-app',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'my-cool-app'),
          } as any,
        },
        secondary: {
          name: 'secondary',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'secondary'),
          } as any,
        },
      },
      dependencies: {},
    };

    await cypressComponentConfiguration(tree, {
      generateTests: true,
      project: 'secondary',
      buildTarget: 'my-cool-app:build',
      skipFormat: true,
    });

    expect(
      tree.read(
        'secondary/src/lib/button/fancy-button.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.read(
        'secondary/src/lib/button/standalone-fancy-button.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should not overwrite existing component test', async () => {
    await generateTestLibrary(tree, {
      directory: 'cool-lib',
      flat: true,
      skipFormat: true,
    });
    await setup(tree, { project: 'cool-lib', name: 'abc', standalone: false });
    tree.write(
      'cool-lib/src/lib/abc-one/abc-one.component.cy.ts',
      `const msg = 'should not overwrite abc-one';`
    );
    tree.write(
      'cool-lib/src/lib/abc-two/abc-two.component.cy.ts',
      `const msg = 'should not overwrite abc-two';`
    );
    tree.write(
      'cool-lib/src/lib/abc-three/abc-three.component.cy.ts',
      `const msg = 'should not overwrite abc-three';`
    );
    projectGraph = {
      nodes: {
        abc: {
          name: 'abc',
          type: 'app',
          data: {
            ...readProjectConfiguration(tree, 'abc'),
          } as any,
        },
        'cool-lib': {
          name: 'cool-lib',
          type: 'lib',
          data: {
            ...readProjectConfiguration(tree, 'cool-lib'),
          } as any,
        },
      },
      dependencies: {},
    };

    await cypressComponentConfiguration(tree, {
      project: 'cool-lib',
      buildTarget: 'abc:build',
      generateTests: true,
      skipFormat: true,
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      name: 'abc',
      basePath: 'cool-lib/src/lib',
    });
    expect(one.cy).toMatchInlineSnapshot(
      `"const msg = 'should not overwrite abc-one';"`
    );
    expect(two.cy).toMatchInlineSnapshot(
      `"const msg = 'should not overwrite abc-two';"`
    );
    expect(three.cy).toMatchInlineSnapshot(
      `"const msg = 'should not overwrite abc-three';"`
    );
  });

  // TODO: should we support this?
  it.skip('should handle multiple components per file', async () => {
    await generateTestLibrary(tree, {
      directory: 'multiple-components',
      flat: true,
      skipFormat: true,
    });
    await componentGenerator(tree, {
      name: 'cmp-one',
      path: 'multiple-components/src/lib/cmp-one',
      skipFormat: true,
    });
    await componentGenerator(tree, {
      name: 'cmp-two',
      path: 'multiple-components/src/lib/cmp-two',
      skipFormat: true,
    });
    tree.write(
      `multiple-components/src/lib/cmp-one.component.ts`,
      `
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'proj-cmp-one',
  templateUrl: './cmp-one.component.html',
  styleUrls: ['./cmp-one.component.css']
})
export class CmpOneComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}

@Component({
  selector: 'proj-cmp-one',
  template: '<h1>Hello World, {{abc}}</h1>',
  styles: []
})
export class CmpMultiComponent implements OnInit {
  @Input() name: string = 'abc'
  constructor() { }
  ngOnInit(): void {}
}
`
    );
    tree.write(
      '',
      `
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CmpOneComponent, CmpMultiComponent } from './cmp-one.component';
import { CmpTwoComponent } from './cmp-two.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    CmpOneComponent,
    CmpTwoComponent
  ]
})
export class MultipleComponentsModule { }
`
    );

    await cypressComponentConfiguration(tree, {
      project: 'multiple-components',
      generateTests: true,
      skipFormat: true,
    });

    expect(
      tree.read('multiple-components/src/lib/cmp-one.component.cy.ts', 'utf-8')
    ).toEqual('');
  });
});

async function setup(
  tree: Tree,
  options: {
    name: string;
    project: string;
    standalone?: boolean;
    withInputs?: boolean;
    basePath?: string;
  }
) {
  await generateTestApplication(tree, {
    directory: options.name,
    standalone: options.standalone,
    skipFormat: true,
  });
  for (const name of [
    `${options.name}-one`,
    `${options.name}-two`,
    `${options.name}-three`,
  ]) {
    await componentGenerator(tree, {
      path: `${options.project}/src/lib/${name}/${name}`,
      name,
      skipFormat: true,
    });

    if (options.withInputs) {
      const cmpPath = joinPathFragments(
        options.basePath,
        name,
        `${name}.component.ts`
      );
      const oldContent = tree.read(cmpPath, 'utf-8');

      const newContent = oldContent.replace(
        'constructor()',
        `
  @Input('buttonType') type = 'button';
  @Input() style: 'default' | 'fancy' | 'link' = 'default';
  @Input() age?: number;
  @Input() isOn = false;
  @Input() message: string | undefined;
  @Input() anotherProp: any;
  @Input() anotherNeverProp: never;

  constructor()`
      );

      tree.write(cmpPath, newContent);
    }
  }
}

function getCmpsFromTree(
  tree: Tree,
  options: { basePath: string; name: string }
) {
  return [
    `${options.name}-one`,
    `${options.name}-two`,
    `${options.name}-three`,
  ].map((n) => {
    expect(
      tree.exists(joinPathFragments(options.basePath, n, `${n}.component.ts`))
    ).toBeTruthy();
    expect(
      tree.exists(
        joinPathFragments(options.basePath, n, `${n}.component.cy.ts`)
      )
    ).toBeTruthy();
    return {
      cmp: tree.read(
        joinPathFragments(options.basePath, n, `${n}.component.ts`),
        'utf-8'
      ),
      cy: tree.read(
        joinPathFragments(options.basePath, n, `${n}.component.cy.ts`),
        'utf-8'
      ),
    };
  });
}
