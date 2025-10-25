import { readFile, runCLI, uniq, updateFile } from '@nx/e2e-utils';
import { setupWebTest } from './web-setup';

describe('Web Components Applications', () => {
  setupWebTest();

  it('should emit decorator metadata when --compiler=babel and it is enabled in tsconfig', async () => {
    const appName = uniq('app');
    runCLI(
      `generate @nx/web:app apps/${appName} --bundler=webpack --compiler=babel --no-interactive --unitTestRunner=vitest --linter=eslint`
    );

    updateFile(`apps/${appName}/src/app/app.element.ts`, (content) => {
      const newContent = `${content}
        function enumerable(value: boolean) {
          return function (
            target: any,
            propertyKey: string,
            descriptor: PropertyDescriptor
          ) {
            descriptor.enumerable = value;
          };
        }
        function sealed(target: any) {
          return target;
        }

        @sealed
        class Foo {
          @enumerable(false) bar() {}
        }
      `;
      return newContent;
    });

    updateFile(`apps/${appName}/src/app/app.element.ts`, (content) => {
      const newContent = `${content}
        // bust babel and nx cache
      `;
      return newContent;
    });
    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    runCLI(`build ${appName}`);

    expect(readFile(`dist/apps/${appName}/main.js`)).toMatch(
      /Reflect\.metadata/
    );

    // Turn off decorator metadata
    updateFile(`apps/${appName}/tsconfig.app.json`, (content) => {
      const json = JSON.parse(content);
      json.compilerOptions.emitDecoratorMetadata = false;
      return JSON.stringify(json);
    });

    setPluginOption(
      `apps/${appName}/webpack.config.js`,
      'outputHashing',
      'none'
    );
    runCLI(`build ${appName}`);

    expect(readFile(`dist/apps/${appName}/main.js`)).not.toMatch(
      /Reflect\.metadata/
    );
  }, 120000);
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
