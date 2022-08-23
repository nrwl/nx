import {
  checkFilesDoNotExist,
  createFile,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '../../utils';
import { names } from '@nrwl/devkit';
describe('Angular Cypress Component Tests', () => {
  let projectName: string;
  const appName = uniq('cy-angular-app');
  const usedInAppLibName = uniq('cy-angular-lib');
  const buildableLibName = uniq('cy-angular-buildable-lib');

  beforeAll(() => {
    projectName = newProject({ name: uniq('cy-ng') });
    runCLI(`generate @nrwl/angular:app ${appName} --no-interactive`);
    runCLI(
      `generate @nrwl/angular:component fancy-component --project=${appName} --no-interactive`
    );
    runCLI(`generate @nrwl/angular:lib ${usedInAppLibName} --no-interactive`);
    runCLI(
      `generate @nrwl/angular:component btn --project=${usedInAppLibName} --inlineTemplate --inlineStyle --export --no-interactive`
    );
    updateFile(
      `libs/${usedInAppLibName}/src/lib/btn/btn.component.ts`,
      `
import { Component, Input } from '@angular/core';

@Component({
  selector: '${projectName}-btn',
  template: '<button class="text-green-500">{{text}}</button>',
  styles: []
})
export class BtnComponent {
  @Input() text = 'something';
}
`
    );
    // use lib in the app
    createFile(
      `apps/${appName}/src/app/app.component.html`,
      `
<${projectName}-btn></${projectName}-btn>
<${projectName}-nx-welcome></${projectName}-nx-welcome>
`
    );
    const btnModuleName = names(usedInAppLibName).className;

    updateFile(
      `apps/${appName}/src/app/app.module.ts`,
      `
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {${btnModuleName}Module} from "@${projectName}/${usedInAppLibName}";

import { AppComponent } from './app.component';
import { NxWelcomeComponent } from './nx-welcome.component';

@NgModule({
  declarations: [AppComponent, NxWelcomeComponent],
  imports: [BrowserModule, ${btnModuleName}Module],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
`
    );

    runCLI(
      `generate @nrwl/angular:lib ${buildableLibName} --buildable --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:component input --project=${buildableLibName} --inlineTemplate --inlineStyle --export --no-interactive`
    );
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.component.ts`,
      `
import {Component, Input} from '@angular/core';

@Component({
  selector: 'ng-tailwind-with-tailwind-alone',
  template: \`<label class="text-green-500">Email: <input class="border-blue-500" type="email" [readOnly]="readOnly"></label>\`,
    styles  : []
  })
  export class InputComponent{
    @Input() readOnly = false;
  }
  `
    );
  });

  it('should test app', () => {
    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${appName} --generate-tests`
    );
    expect(runCLI(`component-test ${appName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);

  it('should successfully component test lib being used in app', () => {
    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${usedInAppLibName} --generate-tests`
    );
    expect(runCLI(`component-test ${usedInAppLibName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);

  it('should test buildable lib not being used in app', () => {
    expect(() => {
      // should error since no edge in graph between lib and app
      runCLI(
        `generate @nrwl/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests`
      );
      // TODO(caleb): make sure it's the correct error.
    }).toThrow();
    createFile(
      `libs/${buildableLibName}/src/lib/input/input.component.cy.ts`,
      `
import { MountConfig, mount } from 'cypress/angular';
import { InputComponent } from './input.component';

describe(InputComponent.name, () => {
  const config: MountConfig<InputComponent> = {
    declarations: [],
    imports: [],
    providers: [],
  };

  it('renders', () => {
    mount(InputComponent, config);
    // make sure tailwind isn't getting applied
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  });
  it('should be readonly', () => {
    mount(InputComponent, {
      ...config,
      componentProperties: {
        readOnly: true,
      },
    });
    cy.get('input').should('have.attr', 'readonly');
  });
});
`
    );

    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build`
    );
    expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
      'All specs passed!'
    );

    // add tailwind
    runCLI(
      `generate @nrwl/angular:setup-tailwind --project=${buildableLibName}`
    );
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.component.cy.ts`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );

    expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
      'All specs passed!'
    );
    checkFilesDoNotExist(`tmp/libs/${buildableLibName}/ct-styles.css`);
  }, 1000000);
});
