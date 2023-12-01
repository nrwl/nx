import {
  addDefaultCTConfig,
  addDefaultE2EConfig,
  addMountDefinition,
} from './config';
describe('Cypress Config parser', () => {
  it('should add CT config to existing e2e config', async () => {
    const actual = await addDefaultCTConfig(
      `import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: nxE2EPreset(__filename),
});
`
    );
    expect(actual).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';
      import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

      export default defineConfig({
        e2e: nxE2EPreset(__filename),
        component: nxComponentTestingPreset(__filename) 
      });
      "
    `);
  });

  it('should add e2e config to existing CT config', async () => {
    const actual = await addDefaultE2EConfig(
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename)
});
`,
      {
        cypressDir: 'cypress',
      },
      undefined
    );
    expect(actual).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
          
          import { defineConfig } from 'cypress';
      import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

      export default defineConfig({
        component: nxComponentTestingPreset(__filename),
        e2e: { ...nxE2EPreset(__filename, {"cypressDir":"cypress"}) } 
      });
      "
    `);
  });

  it('should not overwrite existing config', async () => {
    const actual = await addDefaultE2EConfig(
      `import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: nxE2EPreset(__filename),
});
`,

      {
        cypressDir: 'cypress',
      },
      undefined
    );

    expect(actual).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';
      import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

      export default defineConfig({
        e2e: nxE2EPreset(__filename),
      });
      "
    `);
  });

  it('should merge if there are existing root level properties', async () => {
    const actual = await addDefaultE2EConfig(
      `import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  // should not remove single comment
  foo: 'bar',
  /**
  * should not remove multiline comments
  **/
  video: false
  e2e: nxE2EPreset(__filename),
});
`,

      {
        cypressDir: 'cypress',
      },
      undefined
    );
    expect(actual).toMatchInlineSnapshot(`
      "import { defineConfig } from 'cypress';
      import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

      export default defineConfig({
        // should not remove single comment
        foo: 'bar',
        /**
        * should not remove multiline comments
        **/
        video: false
        e2e: nxE2EPreset(__filename),
      });
      "
    `);
  });

  it('should add baseUrl config', async () => {
    const actual = await addDefaultE2EConfig(
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
});
`,
      {
        cypressDir: 'cypress',
      },
      'https://example.com'
    );
    expect(actual).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
          
          import { defineConfig } from 'cypress';
      import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

      export default defineConfig({
        e2e: { ...nxE2EPreset(__filename, {"cypressDir":"cypress"}),
      baseUrl: 'https://example.com' }
      });
      "
    `);
  });

  it('should add nx metadata for @nx/cypress/plugin', async () => {
    const actual = await addDefaultE2EConfig(
      `import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
});
`,
      {
        cypressDir: 'cypress',
        webServerCommands: {
          default: 'my-app:serve',
          production: 'my-app:serve:production',
        },
        ciWebServerCommand: 'my-app:serve-static',
      },
      undefined
    );
    expect(actual).toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
          
          import { defineConfig } from 'cypress';
      import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

      export default defineConfig({
        e2e: { ...nxE2EPreset(__filename, {"cypressDir":"cypress","webServerCommands":{"default":"my-app:serve","production":"my-app:serve:production"},"ciWebServerCommand":"my-app:serve-static"}) }
      });
      "
    `);
  });

  it('should add a mount config', async () => {
    const actual = await addMountDefinition(
      `/// <reference types="cypress" />
declare global {
// eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Chainable<Subject> {
      login(email: string, password: string): void;
      blah: string;
    }
  }
}
`
    );

    expect(actual).toMatchInlineSnapshot(`
      "/// <reference types="cypress" />
      declare global {
      // eslint-disable-next-line @typescript-eslint/no-namespace
        namespace Cypress {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          interface Chainable<Subject> {
            login(email: string, password: string): void;
            blah: string;
            mount: typeof mount;
          }
        }
      }

      Cypress.Commands.add('mount', mount);"
    `);
  });

  it('should not overwrite mount config', async () => {
    const actual = await addMountDefinition(
      `/// <reference types="cypress" />
import { customMount } from 'something-else';
declare global {
// eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Chainable<Subject> {
      login(email: string, password: string): void;
      mount: 'something-else';
    }
  }
}
Cypress.Commands.add('mount', customMount);
`
    );

    expect(actual).toMatchInlineSnapshot(`
      "/// <reference types="cypress" />
      import { customMount } from 'something-else';
      declare global {
      // eslint-disable-next-line @typescript-eslint/no-namespace
        namespace Cypress {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          interface Chainable<Subject> {
            login(email: string, password: string): void;
            mount: 'something-else';
          }
        }
      }
      Cypress.Commands.add('mount', customMount);
      "
    `);
  });
});
