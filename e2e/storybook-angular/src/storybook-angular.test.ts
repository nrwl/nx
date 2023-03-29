import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  killPorts,
  newProject,
  runCLI,
  runCommand,
  runCommandUntil,
  runCypressTests,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nrwl/e2e/utils';
import { writeFileSync } from 'fs';

describe('Storybook executors for Angular', () => {
  const angularStorybookLib = uniq('ui');
  const cpmName = 'button';
  beforeAll(() => {
    newProject();
    // createTestUILib(angularStorybookLib, cpmName);
    runCLI(`g @nrwl/angular:library ${angularStorybookLib} --no-interactive`);
    runCLI(
      `g @nrwl/angular:component --name=${cpmName} --project=${angularStorybookLib} --no-interactive --verbose`
    );
    runCLI(
      `generate @nrwl/angular:storybook-configuration ${angularStorybookLib} --configureCypress --generateStories --generateCypressSpecs --no-interactive --verbose`
    );

    // TODO: Use --storybook7Configuration and remove this
    updateJson('package.json', (json) => {
      json['overrides'] = {
        'enhanced-resolve': '5.10.0',
        'zone.js': '0.13.0',
        react: '18',
      };

      return json;
    });
    runCommand(getPackageManagerCommand().install);
  });

  afterAll(() => {
    cleanupProject();
  });

  // TODO: Enable on SB7
  describe('serve and build storybook', () => {
    afterAll(() => killPorts());

    xit('should serve an Angular based Storybook setup', async () => {
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
        writeFileSync(
          tmpProjPath(
            `apps/${angularStorybookLib}-e2e/src/e2e/${cpmName}/${cpmName}.component.cy.ts`
          ),
          `
          describe('${angularStorybookLib}, () => {

            it('should render the correct text', () => {
              cy.visit(
                '/iframe.html?id=${cpmName}component--primary&args=text:Click+me;color:#ddffdd;disabled:false;'
              )
              cy.get('button').should('contain', 'Click me');
              cy.get('button').should('not.be.disabled');
            });

            it('should adjust the controls', () => {
              cy.visit(
                '/iframe.html?id=${cpmName}component--primary&args=text:Click+me;color:#ddffdd;disabled:true;'
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

export function createTestUILib(libName: string, cpmName: string): void {
  runCLI(`g @nrwl/angular:library ${libName} --no-interactive`);
  runCLI(
    `g @nrwl/angular:component --name=${cpmName} --project=${libName} --no-interactive`
  );

  writeFileSync(
    tmpProjPath(`libs/${libName}/src/lib/${cpmName}/${cpmName}.component.ts`),
    `
    import { Component, Input } from '@angular/core';

    @Component({
      selector: 'proj-${cpmName}',
      templateUrl: './${cpmName}.component.html',
      styleUrls: ['./${cpmName}.component.css'],
    })
    export class ButtonComponent {
      @Input() text = 'Click me';
      @Input() color = '#ddffdd';
      @Input() disabled = false;
    }
      `
  );

  writeFileSync(
    tmpProjPath(`libs/${libName}/src/lib/${cpmName}/${cpmName}.component.html`),
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
