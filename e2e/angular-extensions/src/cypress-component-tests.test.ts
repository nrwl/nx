import {
  checkFilesDoNotExist,
  cleanupProject,
  createFile,
  newProject,
  packageInstall,
  runCLI,
  uniq,
  updateFile,
  updateProjectConfig,
} from '../../utils';
import { names } from '@nrwl/devkit';
describe('Angular Cypress Component Tests', () => {
  let projectName: string;
  const appName = uniq('cy-angular-app');
  const usedInAppLibName = uniq('cy-angular-lib');
  const buildableLibName = uniq('cy-angular-buildable-lib');

  beforeAll(async () => {
    projectName = newProject({ name: uniq('cy-ng') });
    packageInstall('@nrwl/cypress', projectName, '~12.3.0');
    console.log('1');
    runCLI(`generate @nrwl/angular:app ${appName} --no-interactive`);
    console.log('2');
    runCLI(
      `generate @nrwl/angular:component fancy-component --project=${appName} --no-interactive`
    );
    console.log('3');
    runCLI(`generate @nrwl/angular:lib ${usedInAppLibName} --no-interactive`);
    console.log('4');
    runCLI(
      `generate @nrwl/angular:component btn --project=${usedInAppLibName} --inlineTemplate --inlineStyle --export --no-interactive`
    );
    console.log('5');
    runCLI(
      `generate @nrwl/angular:component btn-standalone --project=${usedInAppLibName} --inlineTemplate --inlineStyle --export --standalone --no-interactive`
    );
    console.log('6');
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
    console.log('7');
    updateFile(
      `libs/${usedInAppLibName}/src/lib/btn-standalone/btn-standalone.component.ts`,
      `
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: '${projectName}-btn-standalone',
  standalone: true,
  imports: [CommonModule],
  template: '<button class="text-green-500">standlone-{{text}}</button>',
  styles: [],
})
export class BtnStandaloneComponent {
  @Input() text = 'something';
}
`
    );
    console.log('8');
    // use lib in the app
    createFile(
      `apps/${appName}/src/app/app.component.html`,
      `
<${projectName}-btn></${projectName}-btn>
<${projectName}-btn-standalone></${projectName}-btn-standalone>
<${projectName}-nx-welcome></${projectName}-nx-welcome>
`
    );
    console.log('9');
    const btnModuleName = names(usedInAppLibName).className;
    updateFile(
      `apps/${appName}/src/app/app.component.scss`,
      `
@use 'styleguide' as *;

h1 {
  @include headline;
}`
    );
    console.log('10');
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
    console.log('11');

    runCLI(
      `generate @nrwl/angular:lib ${buildableLibName} --buildable --no-interactive`
    );
    console.log('12');
    runCLI(
      `generate @nrwl/angular:component input --project=${buildableLibName} --inlineTemplate --inlineStyle --export --no-interactive`
    );
    console.log('13');
    runCLI(
      `generate @nrwl/angular:component input-standalone --project=${buildableLibName} --inlineTemplate --inlineStyle --export --standalone --no-interactive`
    );
    console.log('14');
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.component.ts`,
      `
import {Component, Input} from '@angular/core';

@Component({
  selector: '${projectName}-input',
  template: \`<label class="text-green-500">Email: <input class="border-blue-500" type="email" [readOnly]="readOnly"></label>\`,
    styles  : []
  })
  export class InputComponent{
    @Input() readOnly = false;
  }
  `
    );
    console.log('15');
    updateFile(
      `libs/${buildableLibName}/src/lib/input-standalone/input-standalone.component.ts`,
      `
import {Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
@Component({
  selector: '${projectName}-input-standalone',
  standalone: true,
  imports: [CommonModule],
  template: \`<label class="text-green-500">Email: <input class="border-blue-500" type="email" [readOnly]="readOnly"></label>\`,
    styles  : []
  })
  export class InputStandaloneComponent{
    @Input() readOnly = false;
  }
  `
    );
    console.log('16');

    // make sure assets from the workspace root work.
    createFile('libs/assets/data.json', JSON.stringify({ data: 'data' }));
    console.log('17');
    createFile(
      'assets/styles/styleguide.scss',
      `
    @mixin headline {
    font-weight: bold;
    color: darkkhaki;
    background: lightcoral;
    font-weight: 24px;
  }
  `
    );
    console.log('18');
    updateProjectConfig(appName, (config) => {
      config.targets['build'].options.stylePreprocessorOptions = {
        includePaths: ['assets/styles'],
      };
      config.targets['build'].options.assets.push({
        glob: '**/*',
        input: 'libs/assets',
        output: 'assets',
      });
      return config;
    });
    console.log('19');
  });

  afterAll(() => cleanupProject());

  it('should test app', () => {
    console.log('20');
    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
    );
    console.log('21');
    expect(runCLI(`component-test ${appName} --no-watch`)).toContain(
      'All specs passed!'
    );
    console.log('22');
  }, 300_000);

  it('should successfully component test lib being used in app', () => {
    console.log('23');
    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${usedInAppLibName} --generate-tests --no-interactive`
    );
    console.log('24');
    expect(runCLI(`component-test ${usedInAppLibName} --no-watch`)).toContain(
      'All specs passed!'
    );
    console.log('25');
  }, 300_000);

  it('should test buildable lib not being used in app', () => {
    console.log('26');
    expect(() => {
      // should error since no edge in graph between lib and app
      runCLI(
        `generate @nrwl/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --no-interactive`
      );
    }).toThrow();
    console.log('27');
    createFile(
      `libs/${buildableLibName}/src/lib/input/input.component.cy.ts`,
      `
import { MountConfig } from 'cypress/angular';
import { InputComponent } from './input.component';

describe(InputComponent.name, () => {
  const config: MountConfig<InputComponent> = {
    declarations: [],
    imports: [],
    providers: [],
  };

  it('renders', () => {
    cy.mount(InputComponent, config);
    // make sure tailwind isn't getting applied
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  });
  it('should be readonly', () => {
    cy.mount(InputComponent, {
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
    console.log('28');

    createFile(
      `libs/${buildableLibName}/src/lib/input-standalone/input-standalone.component.cy.ts`,
      `
import { MountConfig } from 'cypress/angular';
import { InputStandaloneComponent } from './input-standalone.component';

describe(InputStandaloneComponent.name, () => {
  const config: MountConfig<InputStandaloneComponent> = {
    declarations: [],
    imports: [],
    providers: [],
  };

  it('renders', () => {
    cy.mount(InputStandaloneComponent, config);
    // make sure tailwind isn't getting applied
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  });
  it('should be readonly', () => {
    cy.mount(InputStandaloneComponent, {
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
    console.log('29');

    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build --no-interactive`
    );
    console.log('30');
    expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
      'All specs passed!'
    );
    console.log('31');

    // add tailwind
    runCLI(
      `generate @nrwl/angular:setup-tailwind --project=${buildableLibName}`
    );
    console.log('32');
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.component.cy.ts`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );
    console.log('33');
    updateFile(
      `libs/${buildableLibName}/src/lib/input-standalone/input-standalone.component.cy.ts`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );
    console.log('34');

    expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
      'All specs passed!'
    );
    console.log('35');
    checkFilesDoNotExist(`tmp/libs/${buildableLibName}/ct-styles.css`);
    console.log('36');
  }, 300_000);
});
