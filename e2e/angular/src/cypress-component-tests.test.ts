import {
  checkFilesDoNotExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  removeFile,
  checkFilesExist,
  updateJson,
} from '../../utils';
import { names } from '@nx/devkit';
import { join } from 'path';

describe('Angular Cypress Component Tests', () => {
  let projectName: string;
  const appName = uniq('cy-angular-app');
  const usedInAppLibName = uniq('cy-angular-lib');
  const buildableLibName = uniq('cy-angular-buildable-lib');

  beforeAll(async () => {
    projectName = newProject({
      name: uniq('cy-ng'),
      packages: ['@nx/angular'],
    });

    createApp(appName);

    createLib(projectName, appName, usedInAppLibName);
    useLibInApp(projectName, appName, usedInAppLibName);

    createBuildableLib(projectName, buildableLibName);

    await useWorkspaceAssetsInApp(appName);
  });

  afterAll(() => cleanupProject());

  it('should test app', () => {
    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);

  it('should successfully component test lib being used in app', () => {
    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${usedInAppLibName} --generate-tests --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${usedInAppLibName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);

  it('should test buildable lib not being used in app', () => {
    expect(() => {
      // should error since no edge in graph between lib and app
      runCLI(
        `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --no-interactive`
      );
    }).toThrow();

    updateTestToAssertTailwindIsNotApplied(buildableLibName);

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
    // add tailwind
    runCLI(`generate @nx/angular:setup-tailwind --project=${buildableLibName}`);
    updateFile(
      `${buildableLibName}/src/lib/input/input.component.cy.ts`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );
    updateFile(
      `${buildableLibName}/src/lib/input-standalone/input-standalone.component.cy.ts`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
      checkFilesDoNotExist(`tmp${buildableLibName}/ct-styles.css`);
    }
  }, 300_000);

  it('should test lib with implicit dep on buildTarget', () => {
    // creates graph like buildableLib -> lib -> app
    // updates the apps styles and they should apply to the buildableLib
    // even though app is not directly connected to buildableLib
    useBuildableLibInLib(projectName, buildableLibName, usedInAppLibName);

    updateBuilableLibTestsToAssertAppStyles(appName, buildableLibName);

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });

  it('should use root level tailwinds config', () => {
    useRootLevelTailwindConfig(join(buildableLibName, 'tailwind.config.js'));
    checkFilesExist('tailwind.config.js');
    checkFilesDoNotExist(`${buildableLibName}/tailwind.config.js`);

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  });
});

function createApp(appName: string) {
  runCLI(
    `generate @nx/angular:app ${appName} --bundler=webpack --project-name-and-root-format=as-provided --no-interactive`
  );
  runCLI(
    `generate @nx/angular:component fancy-component --project=${appName} --no-interactive`
  );
}

function createLib(projectName: string, appName: string, libName: string) {
  runCLI(
    `generate @nx/angular:lib ${libName} --project-name-and-root-format=as-provided --no-interactive`
  );
  runCLI(
    `generate @nx/angular:component btn --project=${libName} --inlineTemplate --inlineStyle --export --no-interactive`
  );
  runCLI(
    `generate @nx/angular:component btn-standalone --project=${libName} --inlineTemplate --inlineStyle --export --standalone --no-interactive`
  );
  updateFile(
    `${libName}/src/lib/btn/btn.component.ts`,
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
  updateFile(
    `${libName}/src/lib/btn-standalone/btn-standalone.component.ts`,
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
}

function createBuildableLib(projectName: string, libName: string) {
  // create lib
  runCLI(
    `generate @nx/angular:lib ${libName} --buildable --project-name-and-root-format=as-provided --no-interactive`
  );
  // create cmp for lib
  runCLI(
    `generate @nx/angular:component input --project=${libName} --inlineTemplate --inlineStyle --export --no-interactive`
  );
  // create standlone cmp for lib
  runCLI(
    `generate @nx/angular:component input-standalone --project=${libName} --inlineTemplate --inlineStyle --export --standalone --no-interactive`
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
    `${libName}/src/lib/input-standalone/input-standalone.component.ts`,
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
}

function useLibInApp(projectName: string, appName: string, libName: string) {
  createFile(
    `${appName}/src/app/app.component.html`,
    `
<${projectName}-btn></${projectName}-btn>
<${projectName}-btn-standalone></${projectName}-btn-standalone>
<${projectName}-nx-welcome></${projectName}-nx-welcome>
`
  );
  const btnModuleName = names(libName).className;
  updateFile(
    `${appName}/src/app/app.component.scss`,
    `
@use 'styleguide' as *;

h1 {
  @include headline;
}`
  );
  updateFile(
    `${appName}/src/app/app.module.ts`,
    `
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {${btnModuleName}Module} from "@${projectName}/${libName}";

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
}

async function useWorkspaceAssetsInApp(appName: string) {
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

function updateTestToAssertTailwindIsNotApplied(libName: string) {
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
    `${libName}/src/lib/input-standalone/input-standalone.component.cy.ts`,
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
}

function useBuildableLibInLib(
  projectName: string,
  buildableLibName: string,
  libName: string
) {
  const buildLibNames = names(buildableLibName);
  // use the buildable lib in lib so now buildableLib has an indirect dep on app
  updateFile(
    `${libName}/src/lib/btn-standalone/btn-standalone.component.ts`,
    `
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputStandaloneComponent } from '@${projectName}/${buildLibNames.fileName}';
@Component({
  selector: '${projectName}-btn-standalone',
  standalone: true,
  imports: [CommonModule, InputStandaloneComponent],
  template: '<button class="text-green-500">standlone-{{text}}</button>${projectName} <${projectName}-input-standalone></${projectName}-input-standalone>',
  styles: [],
})
export class BtnStandaloneComponent {
  @Input() text = 'something';
}
`
  );
}

function updateBuilableLibTestsToAssertAppStyles(
  appName: string,
  buildableLibName: string
) {
  updateFile(`${appName}/src/styles.css`, `label {color: pink !important;}`);

  removeFile(`${buildableLibName}/src/lib/input/input.component.cy.ts`);
  updateFile(
    `${buildableLibName}/src/lib/input-standalone/input-standalone.component.cy.ts`,
    (content) => {
      // app styles should now apply
      return content.replace('rgb(34, 197, 94)', 'rgb(255, 192, 203)');
    }
  );
}

function useRootLevelTailwindConfig(existingConfigPath: string) {
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
