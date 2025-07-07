import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './set-inject-document-domain';

describe('set-inject-document-domain', () => {
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
      targets: {},
    });
    tree.write('apps/app1-e2e/cypress.config.ts', `export const foo = 'bar';`);

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export const foo = 'bar';
      "
    `);
  });

  it('should handle when the cypress config path in the executor is not valid', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/non-existent-cypress.config.ts',
          },
        },
      },
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should set the injectDocumentDomain property to true in the top-level config when there is no e2e or component config', async () => {
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
        // Please ensure you use \`cy.origin()\` when navigating between domains and remove this option.
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should replace the experimentalSkipDomainInjection property in the top-level config with injectDocumentDomain when it is set to an empty array', async () => {
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
  experimentalSkipDomainInjection: [],
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
        // Please ensure you use \`cy.origin()\` when navigating between domains and remove this option.
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should replace the experimentalSkipDomainInjection property in the top-level config with injectDocumentDomain when it is set to an empty array and there is an e2e or component config without experimentalSkipDomainInjection', async () => {
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
  experimentalSkipDomainInjection: [],
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
        },
        // Please ensure you use \`cy.origin()\` when navigating between domains and remove this option.
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });

  it('should remove the experimentalSkipDomainInjection property from the top-level config when it is set to a non-empty array', async () => {
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
  experimentalSkipDomainInjection: ['https://example.com'],
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
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the e2e config when defined and experimentalSkipDomainInjection is not set', async () => {
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
          // Please ensure you use \`cy.origin()\` when navigating between domains and remove this option.
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        },
      });
      "
    `);
  });

  it('should set the injectDocumentDomain property to true in the e2e config when it is not an object literal', async () => {
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
          // Please ensure you use \`cy.origin()\` when navigating between domains and remove this option.
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        },
      });
      "
    `);
  });

  it('should replace the experimentalSkipDomainInjection property in the e2e config with injectDocumentDomain when it is set to an empty array', async () => {
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
    experimentalSkipDomainInjection: [],
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
          // Please ensure you use \`cy.origin()\` when navigating between domains and remove this option.
          // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
          injectDocumentDomain: true,
        },
      });
      "
    `);
  });

  it('should remove the experimentalSkipDomainInjection property from the e2e config when it is set to a non-empty array', async () => {
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
    experimentalSkipDomainInjection: ['https://example.com'],
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
        },
      });
      "
    `);
  });

  it('should not set the injectDocumentDomain property in the component config', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
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
        },
      });
      "
    `);
  });

  it('should handle cypress config files in projects using the "@nx/cypress:cypress" executor', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.custom-config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.custom-config.ts',
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

    expect(tree.read('apps/app1-e2e/cypress.custom-config.ts', 'utf-8'))
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
        // Please ensure you use \`cy.origin()\` when navigating between domains and remove this option.
        // See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
        injectDocumentDomain: true,
      });
      "
    `);
  });
});
