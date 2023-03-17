import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  runCLI,
  runCommandUntil,
  tmpProjPath,
  uniq,
  newProject,
  runCypressTests,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

describe('Storybook generators and executors for monorepos', () => {
  const reactStorybookLib = uniq('test-ui-lib-react');
  const angularStorybookLib = uniq('test-ui-lib');
  let proj;
  beforeAll(() => {
    proj = newProject();
    runCLI(`generate @nrwl/react:lib ${reactStorybookLib} --no-interactive`);
    runCLI(
      `generate @nrwl/react:storybook-configuration ${reactStorybookLib} --storybook7Configuration --generateStories --no-interactive --bundler=webpack`
    );

    createTestUILib(angularStorybookLib);
    runCLI(
      `generate @nrwl/angular:storybook-configuration ${angularStorybookLib} --storybook7Configuration --configureCypress --generateStories --generateCypressSpecs --no-interactive`
    );

    console.log('Here is the Nx report: ');
    runCLI(`report`);
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('serve storybook', () => {
    afterEach(() => killPorts());

    it('should serve a React based Storybook setup that uses webpack', async () => {
      // serve the storybook
      const p = await runCommandUntil(
        `run ${reactStorybookLib}:storybook`,
        (output) => {
          return /Storybook.*started/gi.test(output);
        }
      );
      p.kill();
    }, 1000000);

    it('should serve an Angular based Storybook setup', async () => {
      // serve the storybook
      const p = await runCommandUntil(
        `run ${angularStorybookLib}:storybook`,
        (output) => {
          return /Storybook.*started/gi.test(output);
        }
      );
      p.kill();
    }, 1000000);
  });

  describe('build storybook', () => {
    it('should build a React based storybook setup that uses webpack', () => {
      // build
      runCLI(`run ${reactStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
    }, 1000000);

    it('shoud build an Angular based storybook', () => {
      runCLI(`run ${angularStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
    });

    // This test makes sure path resolution works
    it('should build a React based storybook that references another lib and uses webpack', () => {
      const anotherReactLib = uniq('test-another-lib-react');
      runCLI(`generate @nrwl/react:lib ${anotherReactLib} --no-interactive`);
      // create a React component we can reference
      writeFileSync(
        tmpProjPath(`libs/${anotherReactLib}/src/lib/mytestcmp.tsx`),
        `
        export function MyTestCmp() {
          return (
            <div>
              <h1>Welcome to OtherLib!</h1>
            </div>
          );
        }
        
        export default MyTestCmp;
        `
      );
      // update index.ts and export it
      writeFileSync(
        tmpProjPath(`libs/${anotherReactLib}/src/index.ts`),
        `
            export * from './lib/mytestcmp';
        `
      );

      // create a story in the first lib to reference the cmp from the 2nd lib
      writeFileSync(
        tmpProjPath(
          `libs/${reactStorybookLib}/src/lib/myteststory.stories.tsx`
        ),
        `
            import type { Meta } from '@storybook/react';
            import { MyTestCmp } from '@${proj}/${anotherReactLib}';

            const Story: Meta<typeof MyTestCmp> = {
              component: MyTestCmp,
              title: 'MyTestCmp',
            };
            export default Story;

            export const Primary = {
              args: {},
            };

        `
      );

      // build React lib
      runCLI(`run ${reactStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${reactStorybookLib}/index.html`);
    }, 1000000);
  });

  describe('run cypress tests using storybook', () => {
    it('should execute e2e tests using Cypress running against Storybook', async () => {
      if (runCypressTests()) {
        writeFileSync(
          tmpProjPath(
            `apps/${angularStorybookLib}-e2e/src/e2e/test-button/test-button.component.cy.ts`
          ),
          `
          describe('${angularStorybookLib}, () => {

            it('should render the correct text', () => {
              cy.visit(
                '/iframe.html?id=testbuttoncomponent--primary&args=text:Click+me;color:#ddffdd;disabled:false;'
              )
              cy.get('button').should('contain', 'Click me');
              cy.get('button').should('not.be.disabled');
            });

            it('should adjust the controls', () => {
              cy.visit(
                '/iframe.html?id=testbuttoncomponent--primary&args=text:Click+me;color:#ddffdd;disabled:true;'
              )
              cy.get('button').should('be.disabled');
            });
          });
          `
        );

        const e2eResults = runCLI(`e2e ${angularStorybookLib}-e2e --no-watch`);
        expect(e2eResults).toContain('All specs passed!');
        expect(await killPorts()).toBeTruthy();
      }
    }, 1000000);
  });
});

export function createTestUILib(libName: string): void {
  runCLI(`g @nrwl/angular:library ${libName} --no-interactive`);
  runCLI(
    `g @nrwl/angular:component test-button --project=${libName} --no-interactive`
  );

  writeFileSync(
    tmpProjPath(`libs/${libName}/src/lib/test-button/test-button.component.ts`),
    `
    import { Component, Input } from '@angular/core';

    @Component({
      selector: 'proj-test-button',
      templateUrl: './test-button.component.html',
      styleUrls: ['./test-button.component.css'],
    })
    export class TestButtonComponent {
      @Input() text = 'Click me';
      @Input() color = '#ddffdd';
      @Input() disabled = false;
    }
      `
  );

  writeFileSync(
    tmpProjPath(
      `libs/${libName}/src/lib/test-button/test-button.component.html`
    ),
    `
    <button
    class="my-btn"
    [ngStyle]="{ backgroundColor: color }"
    [disabled]="disabled"
  >
    {{ text }}
  </button>
    `
  );
  runCLI(
    `g @nrwl/angular:component test-other --project=${libName} --no-interactive`
  );
}
