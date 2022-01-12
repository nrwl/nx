import {
  newProject,
  cleanupProject,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import * as path from 'path';

describe('Angular Package', () => {
  describe('linting', () => {
    beforeAll(() => newProject());
    afterAll(() => cleanupProject());

    it('should support eslint and pass linting on the standard generated code', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --linter=eslint`);
      expect(runCLI(`lint ${myapp}`)).toContain('All files pass linting.');

      const mylib = uniq('mylib');
      runCLI(`generate @nrwl/angular:lib ${mylib} --linter=eslint`);
      expect(runCLI(`lint ${mylib}`)).toContain('All files pass linting.');
    });

    it('should support eslint and successfully lint external HTML files and inline templates', async () => {
      const myapp = uniq('myapp');

      runCLI(`generate @nrwl/angular:app ${myapp} --linter=eslint`);

      const templateWhichFailsBananaInBoxLintCheck = `<div ([foo])="bar"></div>`;
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

      // External HTML template file
      updateFile(
        `apps/${myapp}/src/app/app.component.html`,
        templateWhichFailsBananaInBoxLintCheck
      );

      // Inline template within component.ts file
      updateFile(
        `apps/${myapp}/src/app/inline-template.component.ts`,
        wrappedAsInlineTemplate
      );

      const appLintStdOut = runCLI(`lint ${myapp}`, { silenceError: true });
      expect(appLintStdOut).toContain(
        path.normalize(`apps/${myapp}/src/app/app.component.html`)
      );
      expect(appLintStdOut).toContain(`1:6`);
      expect(appLintStdOut).toContain(`Invalid binding syntax`);
      expect(appLintStdOut).toContain(
        path.normalize(`apps/${myapp}/src/app/inline-template.component.ts`)
      );
      expect(appLintStdOut).toContain(
        `The selector should start with one of these prefixes`
      );
      expect(appLintStdOut).toContain(`7:18`);
    });
  });
});
