import {
  checkFilesExist,
  ensureProject,
  readFile,
  runCLI,
  runCLIAsync,
  uniq,
  forEachCli,
  supportUi,
  updateFile
} from './utils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

forEachCli(currentCLIName => {
  describe('Web Components Applications', () => {
    it('should be able to generate a web app', async () => {
      ensureProject();
      const appName = uniq('app');

      const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';
      runCLI(
        `generate @nrwl/web:app ${appName} --no-interactive --linter=${linter}`
      );

      const lintResults = runCLI(`lint ${appName}`);
      expect(lintResults).toContain('All files pass linting.');

      runCLI(`build ${appName}`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/polyfills.js`,
        `dist/apps/${appName}/main.js`,
        `dist/apps/${appName}/styles.js`
      );
      expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
        'class AppElement'
      );
      runCLI(`build ${appName} --prod --output-hashing none`);
      checkFilesExist(
        `dist/apps/${appName}/index.html`,
        `dist/apps/${appName}/runtime.js`,
        `dist/apps/${appName}/polyfills.esm.js`,
        `dist/apps/${appName}/main.esm.js`,
        `dist/apps/${appName}/polyfills.es5.js`,
        `dist/apps/${appName}/main.es5.js`,
        `dist/apps/${appName}/styles.css`
      );
      expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
        `<link rel="stylesheet" href="styles.css">`
      );
      const testResults = await runCLIAsync(`test ${appName}`);
      expect(testResults.stderr).toContain('Test Suites: 1 passed, 1 total');
      const lintE2eResults = runCLI(`lint ${appName}-e2e`);
      expect(lintE2eResults).toContain('All files pass linting.');

      if (supportUi()) {
        const e2eResults = runCLI(`e2e ${appName}-e2e`);
        expect(e2eResults).toContain('All specs passed!');
      }
    }, 120000);

    it('should support same syntax as TypeScript', () => {
      ensureProject();
      const appName = uniq('app');

      runCLI(`generate @nrwl/web:app ${appName} --no-interactive`);

      const mainPath = `apps/${appName}/src/app/app.element.ts`;
      const content = readFile(mainPath);
      updateFile(
        mainPath,
        content
          // Testing decorators
          .replace(
            `export class AppElement extends HTMLElement`,
            stripIndents`
          function myDecorator(ctor) {
            ctor.title = '${appName}';
          }

          @myDecorator
          export class AppElement extends HTMLElement`
          )
          .replace('${title}', '${(AppElement as any).title}') +
          // Testing const enums
          stripIndents`
            export const enum MyEnum {
              a,
              b,
              b
            };
          `
      );

      if (supportUi()) {
        const e2eResults = runCLI(`e2e ${appName}-e2e`);
        expect(e2eResults).toContain('All specs passed!');
      }
    });
  });
});
