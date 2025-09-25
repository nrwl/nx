import { runCLI, runE2ETests, uniq, updateFile, removeFile } from '@nx/e2e-utils';
import { names } from '@nx/devkit';
import { registerAngularCypressCTSetup } from './cypress-component-tests.setup';

describe('Angular Cypress Component Tests - implicit dep on buildTarget', () => {
  registerAngularCypressCTSetup();

  it('should test lib with implicit dep on buildTarget', () => {
    const appName = uniq('cy-angular-app');
    const buildableLibName = uniq('cy-angular-buildable-lib');
    const usedInAppLibName = uniq('cy-angular-lib');

    runCLI(
      `generate @nx/angular:app ${appName} --bundler=webpack --no-interactive`
    );
    runCLI(`generate @nx/angular:lib ${usedInAppLibName} --no-interactive`);
    runCLI(
      `generate @nx/angular:lib ${buildableLibName} --buildable --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${buildableLibName}/src/lib/input-standalone/input-standalone --inlineTemplate --inlineStyle --export --standalone --no-interactive`
    );

    const buildLibNames = names(buildableLibName);
    updateFile(
      `${usedInAppLibName}/src/lib/btn-standalone/btn-standalone.ts`,
      `
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputStandalone } from '@proj/${buildLibNames.fileName}';
@Component({
  selector: 'proj-btn-standalone',
  standalone: true,
  imports: [CommonModule, InputStandalone],
  template: '<button class="text-green-500">standlone-{{text}}</button>proj <proj-input-standalone></proj-input-standalone>',
  styles: [],
})
export class BtnStandalone {
  @Input() text = 'something';
}
`
    );

    updateFile(`${appName}/src/styles.css`, `label {color: pink !important;}`);

    removeFile(`${buildableLibName}/src/lib/input/input.component.cy.ts`);
    updateFile(
      `${buildableLibName}/src/lib/input-standalone/input-standalone.cy.ts`,
      (content) => content.replace('rgb(34, 197, 94)', 'rgb(255, 192, 203)')
    );

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build --no-interactive`
    );

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});
