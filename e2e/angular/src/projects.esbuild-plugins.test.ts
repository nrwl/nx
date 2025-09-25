import { readFile, runCLI, updateFile, updateJson } from '@nx/e2e-utils';
import { join } from 'path';

import { esbuildApp, setupAngularProjectsSuite } from './projects.setup';

describe('Angular Projects - esbuild plugins', () => {
  setupAngularProjectsSuite();

  it('should support esbuild plugins', async () => {
    updateFile(
      `${esbuildApp}/replace-text.plugin.mjs`,
      `const replaceTextPlugin = {
        name: 'replace-text',
        setup(build) {
          const options = build.initialOptions;
          options.define.BUILD_DEFINED = '"Value was provided at build time"';
        },
      };

      export default replaceTextPlugin;`
    );
    updateFile(
      `${esbuildApp}/src/app/app.ts`,
      `import { Component } from '@angular/core';

      declare const BUILD_DEFINED: string;

      @Component({
        selector: 'app-root',
        standalone: false,
        templateUrl: './app.html',
      })
      export class App {
        title = 'esbuild-app';
        buildDefined = BUILD_DEFINED;
      }`
    );

    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:application';
      config.targets.build.options = {
        ...config.targets.build.options,
        plugins: [`${esbuildApp}/replace-text.plugin.mjs`],
      };
      return config;
    });

    runCLI(`build ${esbuildApp} --configuration=development`);

    let mainBundle = readFile(`dist/${esbuildApp}/browser/main.js`);
    expect(mainBundle).toContain(
      'buildDefined = "Value was provided at build time";'
    );

    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:browser-esbuild';
      config.targets.build.options = {
        ...config.targets.build.options,
        main: config.targets.build.options.browser,
        browser: undefined,
        index: `${esbuildApp}/src/index.html`,
      };
      return config;
    });

    runCLI(`build ${esbuildApp} --configuration=development`);

    mainBundle = readFile(`dist/${esbuildApp}/main.js`);
    expect(mainBundle).toContain(
      'buildDefined = "Value was provided at build time";'
    );
  });
});
