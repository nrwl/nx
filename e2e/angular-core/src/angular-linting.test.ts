import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import * as path from 'path';

describe('linting', () => {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());

  it('should lint correctly with eslint and handle external HTML files and inline templates', async () => {
    const app = uniq('app');
    const lib = uniq('lib');

    runCLI(
      `generate @nrwl/angular:app ${app} --linter=eslint --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:lib ${lib} --linter=eslint --no-interactive`
    );

    // check app and lib pass linting for initial generated code
    expect(runCLI(`lint ${app}`)).toContain('All files pass linting.');
    expect(runCLI(`lint ${lib}`)).toContain('All files pass linting.');

    // External HTML template file
    const templateWhichFailsBananaInBoxLintCheck = `<div ([foo])="bar"></div>`;
    updateFile(
      `apps/${app}/src/app/app.component.html`,
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
      `apps/${app}/src/app/inline-template.component.ts`,
      wrappedAsInlineTemplate
    );

    const appLintStdOut = runCLI(`lint ${app}`, { silenceError: true });
    expect(appLintStdOut).toContain(
      path.normalize(`apps/${app}/src/app/app.component.html`)
    );
    expect(appLintStdOut).toContain(`1:6`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);
    expect(appLintStdOut).toContain(
      path.normalize(`apps/${app}/src/app/inline-template.component.ts`)
    );

    expect(appLintStdOut).toContain(`5:19`);
    expect(appLintStdOut).toContain(
      `The selector should start with one of these prefixes`
    );
    expect(appLintStdOut).toContain(`7:16`);
    expect(appLintStdOut).toContain(`Invalid binding syntax`);
  });
});
