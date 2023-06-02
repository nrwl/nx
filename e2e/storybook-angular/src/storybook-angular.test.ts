import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  runCommandUntil,
  runCypressTests,
  tmpProjPath,
  uniq,
} from '@nx/e2e/utils';
import { writeFileSync } from 'fs';

describe('Storybook executors for Angular', () => {
  const angularStorybookLib = uniq('test-ui-ng-lib');
  beforeAll(() => {
    newProject();
    runCLI(`g @nx/angular:library ${angularStorybookLib} --no-interactive`);
    runCLI(
      `generate @nx/angular:storybook-configuration ${angularStorybookLib} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
    );
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('serve and build storybook', () => {
    afterAll(() => killPorts());

    it('should serve an Angular based Storybook setup', async () => {
      const p = await runCommandUntil(
        `run ${angularStorybookLib}:storybook`,
        (output) => {
          return /Storybook.*started/gi.test(output);
        }
      );
      p.kill();
    }, 200_000);

    it('shoud build an Angular based storybook', () => {
      runCLI(`run ${angularStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
    }, 200_000);
  });

  // However much I increase the timeout, this takes forever?
  xdescribe('run cypress tests using storybook', () => {
    it('should execute e2e tests using Cypress running against Storybook', async () => {
      if (runCypressTests()) {
        addTestButtonToUILib(angularStorybookLib);
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
    }, 1000_000);
  });
});

function addTestButtonToUILib(libName: string): void {
  runCLI(
    `g @nx/angular:component test-button --project=${libName} --no-interactive`
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
}
