import { readFile, removeFile, runCLI, updateFile } from '@nx/e2e-utils';
import { normalize } from 'path';

import { app1, lib1, setupAngularProjectsSuite } from './projects.setup';

describe('Angular Projects - lint', () => {
  setupAngularProjectsSuite();

  it('should lint correctly with eslint and handle external HTML files and inline templates', async () => {
    let app1EslintConfig = readFile(`${app1}/eslint.config.mjs`);
    app1EslintConfig = app1EslintConfig.replace(
      `'@angular-eslint/directive-selector': [`,
      `'@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/directive-selector': [`
    );
    updateFile(`${app1}/eslint.config.mjs`, app1EslintConfig);

    runCLI(`run-many --target lint --projects=${app1},${lib1} --parallel`);

    const templateWhichFailsBananaInBoxLintCheck = `<div ([foo])="bar"></div>`;
    updateFile(
      `${app1}/src/app/app.html`,
      templateWhichFailsBananaInBoxLintCheck
    );
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

    removeFile(`${app1}/src/app/inline-template.component.ts`);
  }, 1000000);
});
