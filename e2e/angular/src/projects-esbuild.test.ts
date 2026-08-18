import { readFile, runCLI, updateFile, updateJson } from '@nx/e2e-utils';
import { join } from 'path';
import {
  setupProjectsTest,
  resetProjectsTest,
  cleanupProjectsTest,
  ProjectsTestSetup,
} from './projects-setup';

describe('Angular Projects - Esbuild', () => {
  let setup: ProjectsTestSetup;

  beforeAll(async () => {
    setup = await setupProjectsTest();
  });

  afterEach(() => {
    resetProjectsTest(setup);
  });

  afterAll(() => cleanupProjectsTest());

  it('should support esbuild plugins', async () => {
    const { esbuildApp } = setup;

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

    // check @nx/angular:application
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

    // check @nx/angular:browser-esbuild
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

  it('should support providing a transformer function for the "index.html" file with the application executor', async () => {
    const { esbuildApp } = setup;

    updateFile(
      `${esbuildApp}/index.transformer.mjs`,
      `const indexHtmlTransformer = (indexContent) => {
        return indexContent.replace(
          '<title>${esbuildApp}</title>',
          '<title>${esbuildApp} (transformed)</title>'
        );
      };
      
      export default indexHtmlTransformer;`
    );

    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:application';
      config.targets.build.options = {
        ...config.targets.build.options,
        indexHtmlTransformer: `${esbuildApp}/index.transformer.mjs`,
      };
      return config;
    });

    runCLI(`build ${esbuildApp}`);

    let indexHtmlContent = readFile(`dist/${esbuildApp}/browser/index.html`);
    expect(indexHtmlContent).toContain(
      `<title>${esbuildApp} (transformed)</title>`
    );
  });

  it('should support a TypeScript "index.html" transformer located in a library referenced with {workspaceRoot}', async () => {
    const { esbuildApp, lib1 } = setup;

    // A .ts transformer is loaded via require(), unlike .mjs which Node
    // resolves against cwd. Placing it in a library and referencing it with
    // {workspaceRoot} exercises the workspace-relative path resolution.
    updateFile(
      `${lib1}/src/index.transformer.ts`,
      `const indexHtmlTransformer = (indexContent: string): string => {
        return indexContent.replace(
          '<title>${esbuildApp}</title>',
          '<title>${esbuildApp} (transformed from lib)</title>'
        );
      };

      export default indexHtmlTransformer;`
    );

    updateJson(join(esbuildApp, 'project.json'), (config) => {
      config.targets.build.executor = '@nx/angular:application';
      config.targets.build.options = {
        ...config.targets.build.options,
        indexHtmlTransformer: `{workspaceRoot}/${lib1}/src/index.transformer.ts`,
      };
      return config;
    });

    runCLI(`build ${esbuildApp}`);

    const indexHtmlContent = readFile(`dist/${esbuildApp}/browser/index.html`);
    expect(indexHtmlContent).toContain(
      `<title>${esbuildApp} (transformed from lib)</title>`
    );
  });
});
