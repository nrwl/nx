import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

export let projectName: string;
export let appName: string;
export let usedInAppLibName: string;
export let buildableLibName: string;

export function registerAngularCypressCTSetup() {
  beforeAll(async () => {
    projectName = newProject({
      name: uniq('cy-ng'),
      packages: ['@nx/angular'],
    });

    appName = uniq('cy-angular-app');
    usedInAppLibName = uniq('cy-angular-lib');
    buildableLibName = uniq('cy-angular-buildable-lib');

    runCLI(
      `generate @nx/angular:app ${appName} --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${appName}/src/lib/fancy-component/fancy-component --no-interactive`
    );

    runCLI(`generate @nx/angular:lib ${usedInAppLibName} --no-interactive`);
    runCLI(
      `generate @nx/angular:component ${usedInAppLibName}/src/lib/btn/btn --inlineTemplate --inlineStyle --export --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${usedInAppLibName}/src/lib/btn-standalone/btn-standalone --inlineTemplate --inlineStyle --export --standalone --no-interactive`
    );

    runCLI(
      `generate @nx/angular:lib ${buildableLibName} --buildable --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${buildableLibName}/src/lib/input/input.component --inlineTemplate --inlineStyle --export --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${buildableLibName}/src/lib/input-standalone/input-standalone --inlineTemplate --inlineStyle --export --standalone --no-interactive`
    );

    updateFile(
      `${usedInAppLibName}/src/lib/btn/btn.ts`,
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
      `${usedInAppLibName}/src/lib/btn-standalone/btn-standalone.ts`,
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
  });

  afterAll(() => cleanupProject());
}
