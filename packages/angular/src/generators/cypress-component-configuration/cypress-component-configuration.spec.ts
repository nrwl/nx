import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import {
  DependencyType,
  joinPathFragments,
  ProjectGraph,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from '../component/component';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { generateTestApplication, generateTestLibrary } from '../utils/testing';
import { cypressComponentConfiguration } from './cypress-component-configuration';

let projectGraph: ProjectGraph;
jest.mock('@nx/cypress/src/utils/cypress-version');
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));
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

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    tree.write('.gitignore', '');
    mockedInstalledCypressVersion.mockReturnValue(10);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateProjectConfig', () => {
    it('should add project config with --target=<project>:<target>', async () => {
      await generateTestApplication(tree, {
        name: 'fancy-app',
      });
      await generateTestLibrary(tree, {
        name: 'fancy-lib',
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        project: 'fancy-lib',
        export: true,
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
      });
      expect(
        tree.exists(
          'libs/fancy-lib/src/lib/fancy-cmp/fancy-cmp.component.cy.ts'
        )
      ).toBeFalsy();
      expect(
        readProjectConfiguration(tree, 'fancy-lib').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'libs/fancy-lib/cypress.config.ts',
          devServerTarget: 'fancy-app:build',
          skipServe: true,
          testingType: 'component',
        },
      });
    });

    it('should add project config with --target=<project>:<target>:<config>', async () => {
      await generateTestApplication(tree, {
        name: 'fancy-app',
      });
      await generateTestLibrary(tree, {
        name: 'fancy-lib',
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        project: 'fancy-lib',
        export: true,
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
      });
      expect(
        tree.exists(
          'libs/fancy-lib/src/lib/fancy-cmp/fancy-cmp.component.cy.ts'
        )
      ).toBeFalsy();
      expect(
        readProjectConfiguration(tree, 'fancy-lib').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'libs/fancy-lib/cypress.config.ts',
          devServerTarget: 'fancy-app:build:development',
          skipServe: true,
          testingType: 'component',
        },
      });
    });

    it('should not throw with invalid --build-target', async () => {
      await generateTestApplication(tree, {
        name: 'fancy-app',
      });
      await generateTestLibrary(tree, {
        name: 'fancy-lib',
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        project: 'fancy-lib',
        export: true,
      });
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
        });
      }).resolves;

      expect(
        require('@nx/devkit').createProjectGraphAsync
      ).not.toHaveBeenCalled();
    });
    it('should use own project config', async () => {
      await generateTestApplication(tree, {
        name: 'fancy-app',
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        project: 'fancy-app',
        export: true,
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
      });
      expect(
        readProjectConfiguration(tree, 'fancy-app').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'apps/fancy-app/cypress.config.ts',
          devServerTarget: 'fancy-app:build',
          skipServe: true,
          testingType: 'component',
        },
      });
    });

    it('should use the project graph to find the correct project config', async () => {
      await generateTestApplication(tree, {
        name: 'fancy-app',
      });
      await generateTestLibrary(tree, {
        name: 'fancy-lib',
      });
      await componentGenerator(tree, {
        name: 'fancy-cmp',
        project: 'fancy-lib',
        export: true,
      });
      tree.write(
        'apps/fancy-app/src/app/blah.component.ts',
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
      });
      expect(
        readProjectConfiguration(tree, 'fancy-lib').targets['component-test']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'libs/fancy-lib/cypress.config.ts',
          devServerTarget: 'fancy-app:build',
          skipServe: true,
          testingType: 'component',
        },
      });
    });
  });
  it('should setup angular specific configs', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib',
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
    });

    expect(tree.read('libs/my-lib/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename),
      });
      "
    `);
    expect(
      tree.read('libs/my-lib/cypress/support/component.ts', 'utf-8')
    ).toMatchSnapshot('component.ts');
  });
  it('should work with simple components', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib',
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
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'libs/my-lib/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with standalone component', async () => {
    await generateTestLibrary(tree, {
      name: 'my-lib-standalone',
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
      basePath: 'libs/my-lib-standalone/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with complex component', async () => {
    await generateTestLibrary(tree, {
      name: 'with-inputs-cmp',
    });

    await setup(tree, {
      project: 'with-inputs-cmp',
      name: 'something',
      standalone: false,
      withInputs: true,
      basePath: 'libs/with-inputs-cmp/src/lib',
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
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      basePath: 'libs/with-inputs-cmp/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with complex standalone component', async () => {
    await generateTestLibrary(tree, {
      name: 'with-inputs-standalone-cmp',
    });

    await setup(tree, {
      project: 'with-inputs-standalone-cmp',
      name: 'something',
      standalone: true,
      withInputs: true,
      basePath: 'libs/with-inputs-standalone-cmp/src/lib',
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
      basePath: 'libs/with-inputs-standalone-cmp/src/lib',
      name: 'something',
    });
    expect(one.cy).toMatchSnapshot();
    expect(two.cy).toMatchSnapshot();
    expect(three.cy).toMatchSnapshot();
  });

  it('should work with secondary entry point libs', async () => {
    await generateTestApplication(tree, {
      name: 'my-cool-app',
    });
    await generateTestLibrary(tree, {
      name: 'secondary',
      buildable: true,
    });
    await librarySecondaryEntryPointGenerator(tree, {
      name: 'button',
      library: 'secondary',
    });
    await componentGenerator(tree, {
      name: 'fancy-button',
      path: 'libs/secondary/src/lib/button',
      project: 'secondary',
      flat: true,
    });
    await componentGenerator(tree, {
      name: 'standalone-fancy-button',
      path: 'libs/secondary/src/lib/button',
      project: 'secondary',
      standalone: true,
      flat: true,
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
    });
    expect(
      tree.read(
        'libs/secondary/src/lib/button/fancy-button.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.read(
        'libs/secondary/src/lib/button/standalone-fancy-button.component.cy.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should not overwrite existing component test', async () => {
    await generateTestLibrary(tree, {
      name: 'cool-lib',
      flat: true,
    });
    await setup(tree, { project: 'cool-lib', name: 'abc', standalone: false });
    tree.write(
      'libs/cool-lib/src/lib/abc-one/abc-one.component.cy.ts',
      `const msg = 'should not overwrite abc-one';`
    );
    tree.write(
      'libs/cool-lib/src/lib/abc-two/abc-two.component.cy.ts',
      `const msg = 'should not overwrite abc-two';`
    );
    tree.write(
      'libs/cool-lib/src/lib/abc-three/abc-three.component.cy.ts',
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
    });

    const [one, two, three] = getCmpsFromTree(tree, {
      name: 'abc',
      basePath: 'libs/cool-lib/src/lib',
    });

    expect(one.cy).toMatchInlineSnapshot(`
      "const msg = 'should not overwrite abc-one';
      "
    `);
    expect(two.cy).toMatchInlineSnapshot(`
      "const msg = 'should not overwrite abc-two';
      "
    `);
    expect(three.cy).toMatchInlineSnapshot(`
      "const msg = 'should not overwrite abc-three';
      "
    `);
  });

  // TODO: should we support this?
  it.skip('should handle multiple components per file', async () => {
    await generateTestLibrary(tree, {
      name: 'multiple-components',
      flat: true,
    });

    await componentGenerator(tree, {
      name: 'cmp-one',
      project: 'multiple-components',
      flat: true,
    });
    await componentGenerator(tree, {
      name: 'cmp-two',
      project: 'multiple-components',
      flat: true,
    });
    tree.write(
      `libs/multiple-components/src/lib/cmp-one.component.ts`,
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
    });
    expect(
      tree.read(
        'libs/multiple-components/src/lib/cmp-one.component.cy.ts',
        'utf-8'
      )
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
    name: options.name,
    standalone: options.standalone,
  });
  for (const name of [
    `${options.name}-one`,
    `${options.name}-two`,
    `${options.name}-three`,
  ]) {
    await componentGenerator(tree, { project: options.project, name });

    if (options.withInputs) {
      const cmpPath = joinPathFragments(
        options.basePath,
        name,
        `${name}.component.ts`
      );
      const oldContent = tree.read(
        cmpPath,

        'utf-8'
      );

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
