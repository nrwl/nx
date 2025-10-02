import {
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  removeFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { names } from '@nx/devkit';
import { join } from 'path';

export interface CypressComponentTestsSetup {
  projectName: string;
  appName: string;
  usedInAppLibName: string;
  buildableLibName: string;
}

export function setupCypressComponentTests(): CypressComponentTestsSetup {
  const projectName = newProject({
    name: uniq('cy-ng'),
    packages: ['@nx/angular'],
  });

  const appName = uniq('cy-angular-app');
  const usedInAppLibName = uniq('cy-angular-lib');
  const buildableLibName = uniq('cy-angular-buildable-lib');

  createApp(appName);
  createLib(projectName, appName, usedInAppLibName);
  useLibInApp(projectName, appName, usedInAppLibName);
  createBuildableLib(projectName, buildableLibName);
  useWorkspaceAssetsInApp(appName);

  return {
    projectName,
    appName,
    usedInAppLibName,
    buildableLibName,
  };
}

export function cleanupCypressComponentTests(): void {
  cleanupProject();
}

function createApp(appName: string) {
  runCLI(
    `generate @nx/angular:app ${appName} --bundler=webpack --no-interactive`
  );
  runCLI(
    `generate @nx/angular:component ${appName}/src/lib/fancy-component/fancy-component --no-interactive`
  );
}

function createLib(projectName: string, appName: string, libName: string) {
  runCLI(`generate @nx/angular:lib ${libName} --no-interactive`);
  runCLI(
    `generate @nx/angular:component ${libName}/src/lib/btn/btn --inlineTemplate --inlineStyle --export --no-interactive`
  );
  runCLI(
    `generate @nx/angular:component ${libName}/src/lib/btn-standalone/btn-standalone --inlineTemplate --inlineStyle --export --standalone --no-interactive`
  );
  updateFile(
    `${libName}/src/lib/btn/btn.ts`,
    `
import { Component, Input } from '@angular/core';

@Component({
  selector: '${projectName}-btn',
  template: '<button class="text-green-500">{{text}}</button>',
  styles: []
})
export class Btn {
  @Input() text = 'something';
}
`
  );
  updateFile(
    `${libName}/src/lib/btn-standalone/btn-standalone.ts`,
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
export class BtnStandalone {
  @Input() text = 'something';
}
`
  );
}

function createBuildableLib(projectName: string, libName: string) {
  // create lib
  runCLI(`generate @nx/angular:lib ${libName} --buildable --no-interactive`);
  // create cmp for lib
  runCLI(
    `generate @nx/angular:component ${libName}/src/lib/input/input.component --inlineTemplate --inlineStyle --export --no-interactive`
  );
  // create standlone cmp for lib
  runCLI(
    `generate @nx/angular:component ${libName}/src/lib/input-standalone/input-standalone --inlineTemplate --inlineStyle --export --standalone --no-interactive`
  );
  // update cmp implmentation to use tailwind clasasserting in tests
  updateFile(
    `${libName}/src/lib/input/input.component.ts`,
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
  updateFile(
    `${libName}/src/lib/input-standalone/input-standalone.ts`,
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
  export class InputStandalone{
    @Input() readOnly = false;
  }
  `
  );
}

function useLibInApp(projectName: string, appName: string, libName: string) {
  createFile(
    `${appName}/src/app/app.html`,
    `
<${projectName}-btn></${projectName}-btn>
<${projectName}-btn-standalone></${projectName}-btn-standalone>
<${projectName}-nx-welcome></${projectName}-nx-welcome>
`
  );
  const btnModuleName = names(libName).className;
  updateFile(
    `${appName}/src/app/app.scss`,
    `
@use 'styleguide' as *;

h1 {
  @include headline;
}`
  );
  updateFile(
    `${appName}/src/app/app-module.ts`,
    `
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {${btnModuleName}Module} from "@${projectName}/${libName}";

import { App } from './app';
import { NxWelcome } from './nx-welcome';

@NgModule({
  declarations: [App, NxWelcome],
  imports: [BrowserModule, ${btnModuleName}Module],
  providers: [],
  bootstrap: [App],
})
export class AppModule {}
`
  );
}

function useWorkspaceAssetsInApp(appName: string) {
  // make sure assets from the workspace root work.
  createFile('libs/assets/data.json', JSON.stringify({ data: 'data' }));
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
  updateJson(join(appName, 'project.json'), (config) => {
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
}

export function updateTestToAssertTailwindIsNotApplied(libName: string) {
  createFile(
    `${libName}/src/lib/input/input.component.cy.ts`,
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

  createFile(
    `${libName}/src/lib/input-standalone/input-standalone.cy.ts`,
    `
import { MountConfig } from 'cypress/angular';
import { InputStandalone } from './input-standalone';

describe(InputStandalone.name, () => {
  const config: MountConfig<InputStandalone> = {
    declarations: [],
    imports: [],
    providers: [],
  };

  it('renders', () => {
    cy.mount(InputStandalone, config);
    // make sure tailwind isn't getting applied
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  });
  it('should be readonly', () => {
    cy.mount(InputStandalone, {
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
}

export function useBuildableLibInLib(
  projectName: string,
  buildableLibName: string,
  libName: string
) {
  const buildLibNames = names(buildableLibName);
  // use the buildable lib in lib so now buildableLib has an indirect dep on app
  updateFile(
    `${libName}/src/lib/btn-standalone/btn-standalone.ts`,
    `
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputStandalone } from '@${projectName}/${buildLibNames.fileName}';
@Component({
  selector: '${projectName}-btn-standalone',
  standalone: true,
  imports: [CommonModule, InputStandalone],
  template: '<button class="text-green-500">standlone-{{text}}</button>${projectName} <${projectName}-input-standalone></${projectName}-input-standalone>',
  styles: [],
})
export class BtnStandalone {
  @Input() text = 'something';
}
`
  );
}

export function updateBuilableLibTestsToAssertAppStyles(
  appName: string,
  buildableLibName: string
) {
  updateFile(`${appName}/src/styles.css`, `label {color: pink !important;}`);

  removeFile(`${buildableLibName}/src/lib/input/input.component.cy.ts`);
  updateFile(
    `${buildableLibName}/src/lib/input-standalone/input-standalone.cy.ts`,
    (content) => {
      // app styles should now apply
      return content.replace('rgb(34, 197, 94)', 'rgb(255, 192, 203)');
    }
  );
}

export function useRootLevelTailwindConfig(existingConfigPath: string) {
  createFile(
    'tailwind.config.js',
    `const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [join(__dirname, '**/*.{html,js,ts}')],
  theme: {
    extend: {},
  },
  plugins: [],
};
`
  );
  removeFile(existingConfigPath);
}
