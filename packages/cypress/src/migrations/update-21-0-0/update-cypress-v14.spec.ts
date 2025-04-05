import {
  addProjectConfiguration,
  readJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-cypress-v14';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
}));

describe('update-cypress-v14', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when there are no projects with cypress config', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
    });

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(false);
  });

  it('should do nothing when the cypress config cannot be parsed as expected', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write('apps/app1-e2e/cypress.config.ts', `export const foo = 'bar';`);

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export const foo = 'bar';
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the top-level config when there is no e2e or component config', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  ...nxE2EPreset(__filename, {
    cypressDir: 'src',
    bundler: 'vite',
    webServerCommands: {
      default: 'pnpm exec nx run app1:dev',
      production: 'pnpm exec nx run app1:dev',
    },
    ciWebServerCommand: 'pnpm exec nx run app1:dev',
    ciBaseUrl: 'http://localhost:4200',
  }),
  baseUrl: 'http://localhost:4200',
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        ...nxE2EPreset(__filename, {
          cypressDir: 'src',
          bundler: 'vite',
          webServerCommands: {
            default: 'pnpm exec nx run app1:dev',
            production: 'pnpm exec nx run app1:dev',
          },
          ciWebServerCommand: 'pnpm exec nx run app1:dev',
          ciBaseUrl: 'http://localhost:4200',
        }),
        baseUrl: 'http://localhost:4200',
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the e2e config when it is the only key in the config', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, {
            cypressDir: 'src',
            bundler: 'vite',
            webServerCommands: {
              default: 'pnpm exec nx run app1:dev',
              production: 'pnpm exec nx run app1:dev',
            },
            ciWebServerCommand: 'pnpm exec nx run app1:dev',
            ciBaseUrl: 'http://localhost:4200',
          }),
          baseUrl: 'http://localhost:4200',
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        },
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the top-level config when e2e is the only key in the config but it is not an object literal', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: nxE2EPreset(__filename, {
    cypressDir: 'src',
    bundler: 'vite',
    webServerCommands: {
      default: 'pnpm exec nx run app1:dev',
      production: 'pnpm exec nx run app1:dev',
    },
    ciWebServerCommand: 'pnpm exec nx run app1:dev',
    ciBaseUrl: 'http://localhost:4200',
  }),
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: nxE2EPreset(__filename, {
          cypressDir: 'src',
          bundler: 'vite',
          webServerCommands: {
            default: 'pnpm exec nx run app1:dev',
            production: 'pnpm exec nx run app1:dev',
          },
          ciWebServerCommand: 'pnpm exec nx run app1:dev',
          ciBaseUrl: 'http://localhost:4200',
        }),
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the top-level config when there are top-level properties other than e2e', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'pnpm exec nx run app1:dev',
        production: 'pnpm exec nx run app1:dev',
      },
      ciWebServerCommand: 'pnpm exec nx run app1:dev',
      ciBaseUrl: 'http://localhost:4200',
    }),
  },
  baseUrl: 'http://localhost:4200',
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, {
            cypressDir: 'src',
            bundler: 'vite',
            webServerCommands: {
              default: 'pnpm exec nx run app1:dev',
              production: 'pnpm exec nx run app1:dev',
            },
            ciWebServerCommand: 'pnpm exec nx run app1:dev',
            ciBaseUrl: 'http://localhost:4200',
          }),
        },
        baseUrl: 'http://localhost:4200',
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the component config when it is the only key in the config', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename, { bundler: 'vite' }),
  },
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        component: {
          ...nxComponentTestingPreset(__filename, { bundler: 'vite' }),
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        },
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the top-level config when component is the only key in the config but it is not an object literal', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
import { defineConfig } from 'cypress';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, { bundler: 'vite' }),
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename, { bundler: 'vite' }),
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the top-level config when there are top-level properties other than component', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename, { bundler: 'vite' }),
  },
  baseUrl: 'http://localhost:4200',
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        component: {
          ...nxComponentTestingPreset(__filename, { bundler: 'vite' }),
        },
        baseUrl: 'http://localhost:4200',
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should handle cypress config files in projects not using the "@nx/cypress:cypress" executor', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  ...nxE2EPreset(__filename, {
    cypressDir: 'src',
    bundler: 'vite',
    webServerCommands: {
      default: 'pnpm exec nx run app1:dev',
      production: 'pnpm exec nx run app1:dev',
    },
    ciWebServerCommand: 'pnpm exec nx run app1:dev',
    ciBaseUrl: 'http://localhost:4200',
  }),
  baseUrl: 'http://localhost:4200',
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        ...nxE2EPreset(__filename, {
          cypressDir: 'src',
          bundler: 'vite',
          webServerCommands: {
            default: 'pnpm exec nx run app1:dev',
            production: 'pnpm exec nx run app1:dev',
          },
          ciWebServerCommand: 'pnpm exec nx run app1:dev',
          ciBaseUrl: 'http://localhost:4200',
        }),
        baseUrl: 'http://localhost:4200',
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  describe('removed options', () => {
    it('should remove the experimentalSkipDomainInjection property even if defined multiple times', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    experimentalSkipDomainInjection: true,
  },
  e2e: {
    experimentalSkipDomainInjection: true,
  },
  experimentalSkipDomainInjection: true,
});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          component: {
            devServer: {
              framework: 'vue',
              bundler: 'vite',
            },
          },
          e2e: {},
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        });
        "
      `);
    });

    it('should remove the experimentalFetchPolyfill property even if defined multiple times', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    experimentalFetchPolyfill: true,
  },
  e2e: {
    experimentalFetchPolyfill: true,
  },
  experimentalFetchPolyfill: true,
});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          component: {
            devServer: {
              framework: 'vue',
              bundler: 'vite',
            },
          },
          e2e: {},
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        });
        "
      `);
    });
  });

  describe('CT justInTimeCompile', () => {
    it('should remove the experimentalJustInTimeCompile property from the top-level config when using vite', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
  },
  experimentalJustInTimeCompile: false,
});
`
      );

      await migration(tree);

      const config = tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8');
      expect(config).not.toContain('experimentalJustInTimeCompile');
      expect(config).not.toContain('justInTimeCompile');
    });

    it('should remove the experimentalJustInTimeCompile property from the component config when using vite', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    experimentalJustInTimeCompile: false,
  },
});
`
      );

      await migration(tree);

      const config = tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8');
      expect(config).not.toContain('experimentalJustInTimeCompile');
      expect(config).not.toContain('justInTimeCompile');
    });

    it('should remove the experimentalJustInTimeCompile property from both the top-level config and the component config when using vite', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    experimentalJustInTimeCompile: false,
  },
  experimentalJustInTimeCompile: false,
});
`
      );

      await migration(tree);

      const config = tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8');
      expect(config).not.toContain('experimentalJustInTimeCompile');
      expect(config).not.toContain('justInTimeCompile');
    });

    it('should remove the experimentalJustInTimeCompile property from the top-level config when set to true and it is using webpack', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
  experimentalJustInTimeCompile: true,
});
`
      );

      await migration(tree);

      const config = tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8');
      expect(config).not.toContain('experimentalJustInTimeCompile');
      expect(config).not.toContain('justInTimeCompile');
    });

    it('should rename the experimentalJustInTimeCompile property to justInTimeCompile in the top-level config when set to false and it is using webpack', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
  experimentalJustInTimeCompile: false,
});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          component: {
            devServer: {
              framework: 'react',
              bundler: 'webpack',
            },
          },
          justInTimeCompile: false,
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        });
        "
      `);
    });

    it('should remove the experimentalJustInTimeCompile property from the component config when set to true and it is using webpack', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    experimentalJustInTimeCompile: true,
  },
});
`
      );

      await migration(tree);

      const config = tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8');
      expect(config).not.toContain('experimentalJustInTimeCompile');
      expect(config).not.toContain('justInTimeCompile');
    });

    it('should rename the experimentalJustInTimeCompile property to justInTimeCompile in the component config when set to false and it is using webpack', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    experimentalJustInTimeCompile: false,
  },
});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          component: {
            devServer: {
              framework: 'react',
              bundler: 'webpack',
            },
            justInTimeCompile: false,
            // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
            injectDocumentDomain: true,
          },
        });
        "
      `);
    });
  });

  describe('CT framework changes', () => {
    it('should convert import from cypress/react18 to cypress/react', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1/cypress.config.ts',
        `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});`
      );
      tree.write(
        'apps/app1/src/app/App.cy.tsx',
        `import { mount } from 'cypress/react18';
describe('App', () => {
  it('should render', () => {
    mount(<App />);
  });
});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/app/App.cy.tsx', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { mount } from 'cypress/react';
        describe('App', () => {
          it('should render', () => {
            mount(<App />);
          });
        });
        "
      `);
    });

    it('should convert import from cypress/angular-signals to cypress/angular', async () => {
      const project: ProjectConfiguration = {
        root: 'apps/app1',
        projectType: 'application',
        targets: {},
      };
      projectGraph = {
        nodes: { app1: { name: 'app1', type: 'app', data: project } },
        dependencies: {
          app1: [
            { target: 'npm:@angular/core', type: 'static', source: 'app1' },
          ],
        },
        externalNodes: {
          'npm:@angular/core': {
            name: 'npm:@angular/core',
            type: 'npm',
            data: {
              packageName: '@angular/core',
              version: '19.0.0',
            },
          },
        },
      };
      addProjectConfiguration(tree, 'app1', project);
      tree.write(
        'apps/app1/cypress.config.ts',
        `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
  },
});`
      );
      tree.write(
        'apps/app1/src/app/app.component.cy.ts',
        `import { mount } from 'cypress/angular-signals';
describe('App', () => {
  it('should render', () => {
    mount(AppComponent, {})
  });
});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/app/app.component.cy.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { mount } from 'cypress/angular';
        describe('App', () => {
          it('should render', () => {
            mount(AppComponent, {});
          });
        });
        "
      `);
    });

    it('should convert import from cypress/angular to @cypress/angular and install the package if it is a version lower than v17.2.0', async () => {
      const project: ProjectConfiguration = {
        root: 'apps/app1',
        projectType: 'application',
        targets: {},
      };
      projectGraph = {
        nodes: { app1: { name: 'app1', type: 'app', data: project } },
        dependencies: {
          app1: [
            { target: 'npm:@angular/core', type: 'static', source: 'app1' },
          ],
        },
        externalNodes: {
          'npm:@angular/core': {
            name: 'npm:@angular/core',
            type: 'npm',
            data: {
              packageName: '@angular/core',
              version: '17.1.3',
            },
          },
        },
      };
      addProjectConfiguration(tree, 'app1', project);
      tree.write(
        'apps/app1/cypress.config.ts',
        `import { defineConfig } from 'cypress';
export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
  },
});`
      );
      tree.write(
        'apps/app1/src/app/app.component.cy.ts',
        `import { mount } from 'cypress/angular';
describe('App', () => {
  it('should render', () => {
    mount(AppComponent, {})
  });
});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1/src/app/app.component.cy.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { mount } from '@cypress/angular';
        describe('App', () => {
          it('should render', () => {
            mount(AppComponent, {});
          });
        });
        "
      `);
      expect(
        readJson(tree, 'package.json').devDependencies['@cypress/angular']
      ).toBeDefined();
    });
  });

  describe('different config file exports', () => {
    it('should handle "export default defineConfig()"', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `import { defineConfig } from 'cypress';

export default defineConfig({});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        });
        "
      `);
    });

    it('should handle "export default {}"', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `export default {};
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "export default {
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        };
        "
      `);
    });

    it('should handle "export default <variable>" when <variable> is defined in the file and is an object literal', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `const config = {};

export default config;
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const config = {
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        };

        export default config;
        "
      `);
    });

    it('should handle "module.exports = defineConfig()"', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `const { defineConfig } = require('cypress');

module.exports = defineConfig({});
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { defineConfig } = require('cypress');

        module.exports = defineConfig({
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        });
        "
      `);
    });

    it('should handle "module.exports = {}"', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `module.exports = {};
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        };
        "
      `);
    });

    it('should handle "module.exports = <variable>" when <variable> is defined in the file and is an object literal', async () => {
      addProjectConfiguration(tree, 'app1-e2e', {
        root: 'apps/app1-e2e',
        projectType: 'application',
        targets: {},
      });
      tree.write(
        'apps/app1-e2e/cypress.config.ts',
        `const config = {};

module.exports = config;
`
      );

      await migration(tree);

      expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const config = {
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        };

        module.exports = config;
        "
      `);
    });
  });
});
