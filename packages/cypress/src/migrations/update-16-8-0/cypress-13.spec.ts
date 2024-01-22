import { Tree, addProjectConfiguration, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { updateToCypress13 } from './cypress-13';

describe('Cypress 13', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update deps to cypress v13', async () => {
    setup(tree, { name: 'my-app' });

    await updateToCypress13(tree);
    expect(readJson(tree, 'package.json').devDependencies.cypress).toEqual(
      '^13.0.0'
    );
  });

  it('should update videoUploadOnPasses from config w/setupNodeEvents', async () => {
    setup(tree, { name: 'my-app-video-upload-on-passes' });
    await updateToCypress13(tree);
    expect(
      tree.read('apps/my-app-video-upload-on-passes/cypress.config.ts', 'utf-8')
    ).toMatchInlineSnapshot(`
      "import fs from 'fs';

      import { defineConfig } from 'cypress';
      import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

      export default defineConfig({
        something: 'blah',
        // nodeVersion: 'system',
        // videoUploadOnPasses: false ,
        e2e: {
          ...nxE2EPreset(__filename),
          setupNodeEvents(on, config) {
            const a = '';
            removePassedSpecs(on);
          },
        },
        component: {
          ...nxComponentTestingPreset(__filename),
          setupNodeEvents: (on, config) => {
            const b = '';
            removePassedSpecs(on);
          },
        },
      });

      /**
       * Delete videos for specs that do not contain failing or retried tests.
       * This function is to be used in the 'setupNodeEvents' configuration option as a replacement to
       * 'videoUploadOnPasses' which has been removed.
       *
       * https://docs.cypress.io/guides/guides/screenshots-and-videos#Delete-videos-for-specs-without-failing-or-retried-tests
       **/
      function removePassedSpecs(on) {
        on('after:spec', (spec, results) => {
          if (results && results.vide) {
            const hasFailures = results.tests.some((t) =>
              t.attempts.some((a) => a.state === 'failed')
            );

            if (!hasFailures) {
              fs.unlinkSync(results.video);
            }
          }
        });
      }
      "
    `);
  });
  it('should remove nodeVersion from config', async () => {
    setup(tree, { name: 'my-app-node-version' });
    await updateToCypress13(tree);
    expect(tree.read('apps/my-app-node-version/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import fs from 'fs';

      import { defineConfig } from 'cypress';
      import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

      export default defineConfig({
        something: 'blah',
        // nodeVersion: 'system',
        // videoUploadOnPasses: false ,
        e2e: {
          ...nxE2EPreset(__filename),
          setupNodeEvents(on, config) {
            const a = '';
            removePassedSpecs(on);
          },
        },
        component: {
          ...nxComponentTestingPreset(__filename),
          setupNodeEvents: (on, config) => {
            const b = '';
            removePassedSpecs(on);
          },
        },
      });

      /**
       * Delete videos for specs that do not contain failing or retried tests.
       * This function is to be used in the 'setupNodeEvents' configuration option as a replacement to
       * 'videoUploadOnPasses' which has been removed.
       *
       * https://docs.cypress.io/guides/guides/screenshots-and-videos#Delete-videos-for-specs-without-failing-or-retried-tests
       **/
      function removePassedSpecs(on) {
        on('after:spec', (spec, results) => {
          if (results && results.vide) {
            const hasFailures = results.tests.some((t) =>
              t.attempts.some((a) => a.state === 'failed')
            );

            if (!hasFailures) {
              fs.unlinkSync(results.video);
            }
          }
        });
      }
      "
    `);
  });

  it('should comment about overriding readFile command', async () => {
    setup(tree, { name: 'my-app-read-file' });
    const testContent = `describe('something', () => {
  it('should do the thing', () => {
    cy.readFile('my-data.json').its('name').should('eq', 'Nx');
  });
});
`;
    tree.write('apps/my-app-read-file/src/something.cy.ts', testContent);

    tree.write(
      'apps/my-app-read-file/cypress/support/commands.ts',
      `declare namespace Cypress {
  interface Chainable<Subject> {
    login(email: string, password: string): void;
  }
}
//
// -- This is a parent command --
Cypress.Commands.add('login', (email, password) => {
  console.log('Custom command example: Login', email, password);
});
Cypress.Commands.overwrite('readFile', () => {});

`
    );
    await updateToCypress13(tree);

    expect(
      tree.read('apps/my-app-read-file/src/something.cy.ts', 'utf-8')
    ).toEqual(testContent);
    expect(
      tree.read('apps/my-app-read-file/cypress/support/commands.ts', 'utf-8')
    ).toMatchInlineSnapshot(`
      "declare namespace Cypress {
        interface Chainable<Subject> {
          login(email: string, password: string): void;
        }
      }
      //
      // -- This is a parent command --
      Cypress.Commands.add('login', (email, password) => {
        console.log('Custom command example: Login', email, password);
      });
      /**
       * TODO(@nx/cypress): This command can no longer be overridden
       * Consider using a different name like 'custom_readFile'
       * More info: https://docs.cypress.io/guides/references/migration-guide#readFile-can-no-longer-be-overwritten-with-CypressCommandsoverwrite
       **/
      Cypress.Commands.overwrite('readFile', () => {});
      "
    `);
  });
});

function setup(tree: Tree, options: { name: string }) {
  tree.write(
    `apps/${options.name}/cypress.config.ts`,
    `
import { defineConfig} from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  something: 'blah',
  nodeVersion: 'system',
  videoUploadOnPasses: false,
  e2e: {
    ...nxE2EPreset(__filename),
    videoUploadOnPasses: false,
    nodeVersion: 'bundled',
    setupNodeEvents(on, config) {
      const a = '';
    },
  },
  component: {
    ...nxComponentTestingPreset(__filename),
    videoUploadOnPasses: false,
    nodeVersion: 'something',
    setupNodeEvents: (on, config) => {
      const b = '';
    }
  },
})
`
  );
  tree.write(
    'package.json',
    JSON.stringify({ devDependencies: { cypress: '^12.16.0' } })
  );
  addProjectConfiguration(tree, options.name, {
    root: `apps/${options.name}`,
    sourceRoot: `apps/${options.name}/src`,
    targets: {
      e2e: {
        executor: '@nx/cypress:cypress',
        options: {
          testingType: 'e2e',
          cypressConfig: `apps/${options.name}/cypress.config.ts`,
          devServerTarget: 'app:serve',
        },
      },
      'component-test': {
        executor: '@nx/cypress:cypress',
        options: {
          testingType: 'component',
          cypressConfig: `apps/${options.name}/ct-cypress.config.ts`,
          skipServe: true,
          devServerTarget: 'app:build',
        },
      },
    },
  });
}
