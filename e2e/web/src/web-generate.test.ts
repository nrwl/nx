import {
  checkFilesExist,
  isNotWindows,
  killPorts,
  listFiles,
  readFile,
  runCLI,
  runCLIAsync,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { join } from 'path';
import { copyFileSync } from 'fs';
import { setupWebTest } from './web-setup';

describe('Web Components Applications', () => {
  setupWebTest();

  it('should be able to generate a web app', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --no-interactive --unitTestRunner=vitest --linter=eslint`
    );

    const lintResults = runCLI(`lint ${appName}`);
    expect(lintResults).toContain('Successfully ran target lint');

    const testResults = await runCLIAsync(`test ${appName}`);

    expect(testResults.combinedOutput).toContain(
      `Successfully ran target test for project ${appName}`
    );
    const lintE2eResults = runCLI(`lint ${appName}-e2e`);

    expect(lintE2eResults).toContain('Successfully ran target lint');

    if (isNotWindows() && runE2ETests()) {
      const e2eResults = runCLI(`e2e ${appName}-e2e`);
      expect(e2eResults).toContain('Successfully ran target e2e for project');
      await killPorts();
    }

    copyFileSync(
      join(__dirname, 'test-fixtures/inlined.png'),
      join(tmpProjPath(), `apps/${appName}/src/app/inlined.png`)
    );
    copyFileSync(
      join(__dirname, 'test-fixtures/emitted.png'),
      join(tmpProjPath(), `apps/${appName}/src/app/emitted.png`)
    );
    updateFile(
      `apps/${appName}/src/app/app.element.ts`,
      `
      // @ts-ignore
      import inlined from './inlined.png';
      // @ts-ignore
      import emitted from './emitted.png';
      export class AppElement extends HTMLElement {
        public static observedAttributes = [];
        connectedCallback() {
          this.innerHTML = \`
            <img src='\${inlined} '/>
            <img src='\${emitted} '/>
          \`;
        }
      }
      customElements.define('app-root', AppElement);
    `
    );
    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    runCLI(`build ${appName}`);
    const images = listFiles(`dist/apps/${appName}`).filter((f) =>
      f.endsWith('.png')
    );
    checkFilesExist(
      `dist/apps/${appName}/index.html`,
      `dist/apps/${appName}/runtime.js`,
      `dist/apps/${appName}/main.js`,
      `dist/apps/${appName}/styles.css`
    );
    expect(images.some((f) => f.startsWith('emitted.'))).toBe(true);
    expect(images.some((f) => f.startsWith('inlined.'))).toBe(false);

    expect(readFile(`dist/apps/${appName}/main.js`)).toContain(
      'data:image/png;base64'
    );
    // Should not be a JS module but kept as a PNG
    expect(
      readFile(
        `dist/apps/${appName}/${images.find((f) => f.startsWith('emitted.'))}`
      )
    ).not.toContain('export default');

    expect(readFile(`dist/apps/${appName}/index.html`)).toContain(
      '<link rel="stylesheet" href="styles.css">'
    );
  }, 500000);
});

function setPluginOption(
  webpackConfigPath: string,
  option: string,
  value: string | boolean
): void {
  updateFile(webpackConfigPath, (content) => {
    return content.replace(
      new RegExp(`${option}: .+`),
      `${option}: ${typeof value === 'string' ? `'${value}'` : value},`
    );
  });
}
