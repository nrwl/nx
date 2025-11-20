import { readFile, removeFile, runCLI, updateFile } from '@nx/e2e-utils';
import { normalize } from 'path';
import {
  setupProjectsTest,
  resetProjectsTest,
  cleanupProjectsTest,
  ProjectsTestSetup,
} from './projects-setup';

describe('Angular Projects - Linting', () => {
  let setup: ProjectsTestSetup;

  beforeAll(() => {
    setup = setupProjectsTest();
  });

  afterEach(() => {
    resetProjectsTest(setup);
  });

  afterAll(() => cleanupProjectsTest());

  it('should lint correctly with eslint and handle external HTML files and inline templates', async () => {
    const { app1, lib1 } = setup;

    // disable the prefer-standalone rule for app1 which is not standalone
    let app1EslintConfig = readFile(`${app1}/eslint.config.mjs`);
    app1EslintConfig = app1EslintConfig.replace(
      `'@angular-eslint/directive-selector': [`,
      `'@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/directive-selector': [`
    );
    updateFile(`${app1}/eslint.config.mjs`, app1EslintConfig);

    // check apps and lib pass linting for initial generated code
    runCLI(`run-many --target lint --projects=${app1},${lib1} --parallel`);

    // External HTML template file
    const templateWhichFailsBananaInBoxLintCheck = `<div ([foo])="bar"></div>`;
    updateFile(
      `${app1}/src/app/app.html`,
      templateWhichFailsBananaInBoxLintCheck
    );
    // Inline template within component.ts file
    const wrappedAsInlineTemplate = `
      import { Component } from '@angular/core';

      @Component({
        selector: 'inline-template-component',
        template: \`
          ${templateWhichFailsBananaInBoxLintCheck}
        \`,
      })
      export class InlineTemplateComponent {}
    `;
    updateFile(
      `${app1}/src/app/inline-template.component.ts`,
      wrappedAsInlineTemplate
    );

    const appLintStdOut = runCLI(`lint ${app1}`, {
      silenceError: true,
    });
    expect(appLintStdOut).toContain(normalize(`${app1}/src/app/app.html`));
    expect(appLintStdOut).toContain(`1:6`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);
    expect(appLintStdOut).toContain(
      normalize(`${app1}/src/app/inline-template.component.ts`)
    );
    expect(appLintStdOut).toContain(`5:19`);
    expect(appLintStdOut).toContain(
      `The selector should start with one of these prefixes`
    );
    expect(appLintStdOut).toContain(`7:16`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);

    // cleanup added component
    removeFile(`${app1}/src/app/inline-template.component.ts`);
  }, 1000000);
});
