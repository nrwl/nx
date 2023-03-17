import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  killPorts,
  newProject,
  runCLI,
  runCommand,
  runCypressTests,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

describe('Storybook for Angular', () => {
  const angularStorybookLib = uniq('test-ui-lib');
  beforeAll(() => {
    newProject();
    createTestUILib(angularStorybookLib);
    runCLI(
      `generate @nrwl/angular:storybook-configuration ${angularStorybookLib} --configureCypress --generateStories --generateCypressSpecs --no-interactive`
    );

    // TODO(jack): Overriding enhanced-resolve to 5.10.0 now until the package is fixed.
    // TODO: Use --storybook7Configuration and remove this
    // See: https://github.com/webpack/enhanced-resolve/issues/362
    updateJson('package.json', (json) => {
      json['overrides'] = {
        'enhanced-resolve': '5.10.0',
      };

      return json;
    });
    runCommand(getPackageManagerCommand().install);

    console.log('Here is the Nx report: ');
    runCLI(`report`);
  });

  afterAll(() => {
    cleanupProject();
  });

  // TODO: Use --storybook7Configuration and re-enable this
  xdescribe('Storybook builder', () => {
    it('shoud build storybook', () => {
      runCLI(`run ${angularStorybookLib}:build-storybook --verbose`);
      checkFilesExist(`dist/storybook/${angularStorybookLib}/index.html`);
    });
  });

  // TODO: Use --storybook7Configuration and re-enable this
  xdescribe('run cypress tests using storybook', () => {
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
