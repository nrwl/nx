import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  stripIndents,
  Tree,
  readJson,
} from '@nx/devkit';
import {
  shouldNotOverrideCommands,
  shouldNotUseCyInShouldCB,
  shouldUseCyIntercept,
  shouldUseCySession,
  turnOffTestIsolation,
  updateToCypress12,
} from './update-to-cypress-12';
import { installedCypressVersion } from '../../utils/cypress-version';
jest.mock('../../utils/cypress-version');

describe('Cypress 12 Migration', () => {
  let tree: Tree;
  let mockInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.resetAllMocks();
  });

  it('should migrate to cy 12', () => {
    mockInstalledCypressVersion.mockReturnValue(11);
    addCypressProject(tree, 'my-app-e2e');
    addCypressProject(tree, 'my-other-app-e2e');
    updateToCypress12(tree);
    assertMigration(tree, 'my-app-e2e');
    assertMigration(tree, 'my-other-app-e2e');
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['cypress']).toEqual('^12.2.0');
  });

  it('should not migrate if cypress version is < 11', () => {
    mockInstalledCypressVersion.mockReturnValue(10);
    addCypressProject(tree, 'my-app-e2e');
    updateToCypress12(tree);
    expect(tree.read('apps/my-app-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';
      import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

      export default defineConfig({
        e2e: nxE2EPreset(__filename)
      })"
    `);
  });

  describe('nest cypress commands in should callback', () => {
    beforeEach(() => {
      tree.write(
        'should-callback.ts',
        `describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    cy.server()

    cy.wait('@getApi')
       .its('url').should('include', 'api/v1')
    cy.should((b) => {
      const a = 123;
      // I'm not doing nested cy stuff
    });
    cy.should(($s) => {
      cy.task("");
    })
    cy.should(function($el) {
      cy.task("");
    })
  })
})
`
      );
    });
    it('should comment', () => {
      shouldNotUseCyInShouldCB(tree, 'should-callback.ts');
      expect(tree.read('should-callback.ts', 'utf-8')).toMatchInlineSnapshot(`
        "describe('something', () => {
          it('should do the thing', () => {
            Cypress.Cookies.defaults()
            cy.server()

            cy.wait('@getApi')
               .its('url').should('include', 'api/v1')
            cy.should((b) => {
              const a = 123;
              // I'm not doing nested cy stuff
            });
            /**
        * TODO(@nrwl/cypress): Nesting Cypress commands in a should assertion now throws.
        * You should use .then() to chain commands instead.
        * More Info: https://docs.cypress.io/guides/references/migration-guide#-should
        **/
        cy.should(($s) => {
              cy.task("");
            })
            /**
        * TODO(@nrwl/cypress): Nesting Cypress commands in a should assertion now throws.
        * You should use .then() to chain commands instead.
        * More Info: https://docs.cypress.io/guides/references/migration-guide#-should
        **/
        cy.should(function($el) {
              cy.task("");
            })
          })
        })
        "
      `);
    });

    it('should be idempotent', () => {
      const expected = `describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    cy.server()

    cy.wait('@getApi')
       .its('url').should('include', 'api/v1')
    cy.should((b) => {
      const a = 123;
      // I'm not doing nested cy stuff
    });
    /**
* TODO(@nrwl/cypress): Nesting Cypress commands in a should assertion now throws.
* You should use .then() to chain commands instead.
* More Info: https://docs.cypress.io/guides/references/migration-guide#-should
**/
cy.should(($s) => {
      cy.task("");
    })
    /**
* TODO(@nrwl/cypress): Nesting Cypress commands in a should assertion now throws.
* You should use .then() to chain commands instead.
* More Info: https://docs.cypress.io/guides/references/migration-guide#-should
**/
cy.should(function($el) {
      cy.task("");
    })
  })
})
`;
      shouldNotUseCyInShouldCB(tree, 'should-callback.ts');
      expect(tree.read('should-callback.ts', 'utf-8')).toEqual(expected);
      shouldNotUseCyInShouldCB(tree, 'should-callback.ts');
      expect(tree.read('should-callback.ts', 'utf-8')).toEqual(expected);
    });
  });
  describe('banned Cypres.Commands.overwrite', () => {
    beforeEach(() => {
      tree.write(
        'commands.ts',
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
Cypress.Commands.overwrite('find', () => {});
`
      );
    });
    it('should comment', () => {
      shouldNotOverrideCommands(tree, 'commands.ts');
      expect(tree.read('commands.ts', 'utf-8')).toMatchInlineSnapshot(`
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
        * TODO(@nrwl/cypress): This command can no longer be overridden
        * Consider using a different name like 'custom_find'
        * More info: https://docs.cypress.io/guides/references/migration-guide#Cypress-Commands-overwrite
        **/
        Cypress.Commands.overwrite('find', () => {});
        "
      `);
    });

    it('should be idempotent', () => {
      const expected = `declare namespace Cypress {
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
* TODO(@nrwl/cypress): This command can no longer be overridden
* Consider using a different name like 'custom_find'
* More info: https://docs.cypress.io/guides/references/migration-guide#Cypress-Commands-overwrite
**/
Cypress.Commands.overwrite('find', () => {});
`;

      shouldNotOverrideCommands(tree, 'commands.ts');
      expect(tree.read('commands.ts', 'utf-8')).toEqual(expected);
      shouldNotOverrideCommands(tree, 'commands.ts');
      expect(tree.read('commands.ts', 'utf-8')).toEqual(expected);
    });
  });
  describe('api removal', () => {
    it('should be idempotent', () => {
      tree.write(
        'my-cool-test.cy.ts',
        `
describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
    Cypress.blah.abc() 
    Cypress.Server.defaults({
     delay: 500,
     method: 'GET',
   })
   cy.server()
   cy.route(/api/, () => {
      return {
        'test': 'We’ll',
      }
    }).as('getApi')
 
    cy.visit('/index.html')
    cy.window().then((win) => {
      const xhr = new win.XMLHttpRequest
      xhr.open('GET', '/api/v1/foo/bar?a=42')
      xhr.send()
    })

    cy.wait('@getApi')
   .its('url').should('include', 'api/v1')
  })
})
`
      );
      const expected = stripIndents`describe('something', () => {
      it('should do the thing', () => {
        // TODO(@nrwl/cypress): this command has been removed, use cy.session instead. https://docs.cypress.io/guides/references/migration-guide#Command-Cypress-API-Changes
    Cypress.Cookies.defaults()
        // TODO(@nrwl/cypress): this command has been removed, use cy.session instead. https://docs.cypress.io/guides/references/migration-guide#Command-Cypress-API-Changes
    Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
        Cypress.blah.abc()
        // TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults
    Cypress.Server.defaults({
         delay: 500,
         method: 'GET',
       })
       // TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults
    cy.server()
       // TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults
    cy.route(/api/, () => {
          return {
            'test': 'We’ll',
          }
        }).as('getApi')

        cy.visit('/index.html')
        cy.window().then((win) => {
          const xhr = new win.XMLHttpRequest
          xhr.open('GET', '/api/v1/foo/bar?a=42')
          xhr.send()
        })

        cy.wait('@getApi')
       .its('url').should('include', 'api/v1')
      })
    })`;
      shouldUseCyIntercept(tree, 'my-cool-test.cy.ts');
      shouldUseCySession(tree, 'my-cool-test.cy.ts');
      expect(stripIndents`${tree.read('my-cool-test.cy.ts', 'utf-8')}`).toEqual(
        expected
      );

      shouldUseCyIntercept(tree, 'my-cool-test.cy.ts');
      shouldUseCySession(tree, 'my-cool-test.cy.ts');
      expect(stripIndents`${tree.read('my-cool-test.cy.ts', 'utf-8')}`).toEqual(
        expected
      );
    });
    it('comment on cy.route,cy.server, & Cypress.Server.defaults usage', () => {
      tree.write(
        'my-cool-test.cy.ts',
        `
describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
    Cypress.blah.abc() 
    Cypress.Server.defaults({
     delay: 500,
     method: 'GET',
   })
   cy.server()
   cy.route(/api/, () => {
      return {
        'test': 'We’ll',
      }
    }).as('getApi')
 
    cy.visit('/index.html')
    cy.window().then((win) => {
      const xhr = new win.XMLHttpRequest
      xhr.open('GET', '/api/v1/foo/bar?a=42')
      xhr.send()
    })

    cy.wait('@getApi')
   .its('url').should('include', 'api/v1')
  })
})
`
      );
      shouldUseCyIntercept(tree, 'my-cool-test.cy.ts');
      expect(tree.read('my-cool-test.cy.ts', 'utf-8')).toMatchInlineSnapshot(`
        "
        describe('something', () => {
          it('should do the thing', () => {
            Cypress.Cookies.defaults()
            Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
            Cypress.blah.abc() 
            // TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults
        Cypress.Server.defaults({
             delay: 500,
             method: 'GET',
           })
           // TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults
        cy.server()
           // TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults
        cy.route(/api/, () => {
              return {
                'test': 'We’ll',
              }
            }).as('getApi')
         
            cy.visit('/index.html')
            cy.window().then((win) => {
              const xhr = new win.XMLHttpRequest
              xhr.open('GET', '/api/v1/foo/bar?a=42')
              xhr.send()
            })

            cy.wait('@getApi')
           .its('url').should('include', 'api/v1')
          })
        })
        "
      `);
    });

    it('comment on Cypress.Cookies.defaults & Cypress.Cookies.preserveOnce', () => {
      tree.write(
        'my-cool-test.cy.ts',
        `
describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
    Cypress.blah.abc() 
    Cypress.Server.defaults({
     delay: 500,
     method: 'GET',
   })
   cy.server()

    cy.wait('@getApi')
   .its('url').should('include', 'api/v1')
  })
})
`
      );
      shouldUseCySession(tree, 'my-cool-test.cy.ts');
      expect(tree.read('my-cool-test.cy.ts', 'utf-8')).toMatchInlineSnapshot(`
        "
        describe('something', () => {
          it('should do the thing', () => {
            // TODO(@nrwl/cypress): this command has been removed, use cy.session instead. https://docs.cypress.io/guides/references/migration-guide#Command-Cypress-API-Changes
        Cypress.Cookies.defaults()
            // TODO(@nrwl/cypress): this command has been removed, use cy.session instead. https://docs.cypress.io/guides/references/migration-guide#Command-Cypress-API-Changes
        Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
            Cypress.blah.abc() 
            Cypress.Server.defaults({
             delay: 500,
             method: 'GET',
           })
           cy.server()

            cy.wait('@getApi')
           .its('url').should('include', 'api/v1')
          })
        })
        "
      `);
    });
  });
  describe('testIsolation', () => {
    it('should be idempotent', () => {
      const content = `
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename),
    testIsolation: true,
})
`;
      tree.write('my-cypress.config.ts', content);
      turnOffTestIsolation(tree, 'my-cypress.config.ts');

      expect(tree.read('my-cypress.config.ts', 'utf-8')).toEqual(content);
    });
    it('should add testIsolation: false to the default e2e config', () => {
      tree.write(
        'my-cypress.config.ts',
        `
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: nxE2EPreset(__filename),
})
`
      );
      turnOffTestIsolation(tree, 'my-cypress.config.ts');
      expect(tree.read('my-cypress.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "
        import { defineConfig } from 'cypress';
        import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename),
            /**
            * TODO(@nrwl/cypress): In Cypress v12,the testIsolation option is turned on by default. 
            * This can cause tests to start breaking where not indended.
            * You should consider enabling this once you verify tests do not depend on each other
            * More Info: https://docs.cypress.io/guides/references/migration-guide#Test-Isolation
            **/
            testIsolation: false,
          },
        })
        "
      `);
    });

    it('should add testIsolation: false to inline object e2e config', () => {
      tree.write(
        'my-cypress.config.ts',
        `
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename),
    video: false
  }
})
`
      );
      turnOffTestIsolation(tree, 'my-cypress.config.ts');
      expect(tree.read('my-cypress.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "
        import { defineConfig } from 'cypress';
        import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

        export default defineConfig({
          e2e: {
            ...nxE2EPreset(__filename),
            video: false,
            /**
            * TODO(@nrwl/cypress): In Cypress v12,the testIsolation option is turned on by default. 
            * This can cause tests to start breaking where not indended.
            * You should consider enabling this once you verify tests do not depend on each other
            * More Info: https://docs.cypress.io/guides/references/migration-guide#Test-Isolation
            **/
            testIsolation: false,
         }
        })
        "
      `);
    });

    it('should add testIsolation: false for a variable e2e config', () => {
      tree.write(
        'my-cypress.config.ts',
        `
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';
const myConfig = {
    ...nxE2EPreset(__filename),
    video: false
  }

export default defineConfig({
  e2e: myConfig,
})
`
      );
      turnOffTestIsolation(tree, 'my-cypress.config.ts');
      expect(tree.read('my-cypress.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "
        import { defineConfig } from 'cypress';
        import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';
        const myConfig = {
            ...nxE2EPreset(__filename),
            video: false
          }

        export default defineConfig({
          e2e: {
            ...myConfig,
            /**
            * TODO(@nrwl/cypress): In Cypress v12,the testIsolation option is turned on by default. 
            * This can cause tests to start breaking where not indended.
            * You should consider enabling this once you verify tests do not depend on each other
            * More Info: https://docs.cypress.io/guides/references/migration-guide#Test-Isolation
            **/
            testIsolation: false,
          },
        })
        "
      `);
    });
  });
});

function addCypressProject(tree: Tree, name: string) {
  const targets = {
    e2e: {
      executor: '@nrwl/cypress:cypress',
      options: {
        tsConfig: `apps/${name}/tsconfig.e2e.json`,
        testingType: 'e2e',
        browser: 'chrome',
      },
      configurations: {
        dev: {
          cypressConfig: `apps/${name}/cypress.config.ts`,
          devServerTarget: 'client:serve:dev',
          baseUrl: 'http://localhost:4206',
        },
        watch: {
          cypressConfig: 'apps/client-e2e/cypress-custom.config.ts',
          devServerTarget: 'client:serve:watch',
          baseUrl: 'http://localhost:4204',
        },
      },
      defaultConfiguration: 'dev',
    },
  };
  addProjectConfiguration(tree, name, {
    root: `apps/${name}`,
    sourceRoot: `apps/${name}/src`,
    projectType: 'application',
    targets,
  });
  // testIsolation
  tree.write(
    `apps/${name}/cypress.config.ts`,
    `import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: nxE2EPreset(__filename)
})`
  );
  // test Cypress.Commands.Override
  tree.write(
    `apps/${name}/src/support/commands.ts`,
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
Cypress.Commands.overwrite('find', () => {});
`
  );
  // test .should(() => cy.<cmd>)
  tree.write(
    `apps/${name}/src/e2e/callback.spec.ts`,
    `describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    cy.server()

    cy.wait('@getApi')
       .its('url').should('include', 'api/v1')
    cy.should((b) => {
      const a = 123;
      // I'm not doing nested cy stuff
    });
    cy.should(($s) => {
      cy.task("");
    })
    cy.should(function($el) {
      cy.task("");
    })
  })
})`
  );
  tree.write(
    `apps/${name}/src/e2e/intercept-session.spec.ts`,
    `describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
    Cypress.blah.abc() 
    Cypress.Server.defaults({
     delay: 500,
     method: 'GET',
   })
   cy.server()
   cy.route(/api/, () => {
      return {
        'test': 'We’ll',
      }
    }).as('getApi')
 
    cy.visit('/index.html')
    cy.window().then((win) => {
      const xhr = new win.XMLHttpRequest
      xhr.open('GET', '/api/v1/foo/bar?a=42')
      xhr.send()
    })

    cy.wait('@getApi')
   .its('url').should('include', 'api/v1')
  })
})`
  );
  tree.write(
    `apps/${name}/src/e2e/combo.spec.ts`,
    `describe('something', () => {
  it('should do the thing', () => {
    Cypress.Cookies.defaults()
    Cypress.Cookies.preserveOnce('seesion_id', 'remember-token');
    Cypress.blah.abc() 
    Cypress.Server.defaults({
     delay: 500,
     method: 'GET',
   })
   cy.server()
   cy.route(/api/, () => {
      return {
        'test': 'We’ll',
      }
    }).as('getApi')
 
    cy.visit('/index.html')
    cy.window().then((win) => {
      const xhr = new win.XMLHttpRequest
      xhr.open('GET', '/api/v1/foo/bar?a=42')
      xhr.send()
    })

    cy.wait('@getApi')
   .its('url').should('include', 'api/v1')
    cy.should(($s) => {
      cy.get('@table').find('tr').should('have.length', 3)
})
  })
})`
  );
}

function assertMigration(tree: Tree, name: string) {
  expect(tree.read(`apps/${name}/cypress.config.ts`, 'utf-8')).toContain(
    'testIsolation: false'
  );
  // command overrides
  expect(tree.read(`apps/${name}/src/support/commands.ts`, 'utf-8')).toContain(
    'TODO(@nrwl/cypress): This command can no longer be overridden'
  );
  // test .should(() => cy.<cmd>)
  expect(tree.read(`apps/${name}/src/e2e/callback.spec.ts`, 'utf-8')).toContain(
    'TODO(@nrwl/cypress): Nesting Cypress commands in a should assertion now throws.'
  );
  // use cy.intercept, cy.session
  const interceptSessionSpec = tree.read(
    `apps/${name}/src/e2e/intercept-session.spec.ts`,
    'utf-8'
  );
  expect(interceptSessionSpec).toContain(
    '// TODO(@nrwl/cypress): this command has been removed, use cy.session instead. https://docs.cypress.io/guides/references/migration-guide#Command-Cypress-API-Changes'
  );
  expect(interceptSessionSpec).toContain(
    '// TODO(@nrwl/cypress): this command has been removed, use cy.intercept instead. https://docs.cypress.io/guides/references/migration-guide#cy-server-cy-route-and-Cypress-Server-defaults'
  );
  // intercept,session & callback
  expect(
    tree.read(`apps/${name}/src/e2e/combo.spec.ts`, 'utf-8')
  ).toMatchSnapshot();
}
