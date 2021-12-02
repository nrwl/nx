process.env.SELECTED_CLI = 'angular';

import {
  checkFilesExist,
  getSelectedPackageManager,
  newProject,
  packageInstall,
  readFile,
  readJson,
  removeProject,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';
import { join } from 'path';

describe('Angular Package', () => {
  ['publishable', 'buildable'].forEach((testConfig) => {
    describe(`library builder - ${testConfig}`, () => {
      /**
       * Graph:
       *
       *                 childLib
       *               /
       * parentLib =>
       *               \
       *                 childLib2
       *
       */
      let parentLib: string;
      let childLib: string;
      let childLib2: string;
      let proj: string;

      beforeEach(() => {
        parentLib = uniq('parentlib');
        childLib = uniq('childlib');
        childLib2 = uniq('childlib2');

        // These fail with pnpm due to incompatibilities with ngcc for buildable libraries.
        // therefore switch to yarn
        proj =
          getSelectedPackageManager() === 'pnpm' && testConfig !== 'publishable'
            ? newProject({ packageManager: 'yarn' })
            : newProject();

        if (testConfig === 'buildable') {
          runCLI(
            `generate @nrwl/angular:library ${parentLib} --buildable=true --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib} --buildable=true --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib2} --buildable=true --no-interactive`
          );
        } else {
          runCLI(
            `generate @nrwl/angular:library ${parentLib} --publishable=true --importPath=@${proj}/${parentLib} --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib} --publishable=true --importPath=@${proj}/${childLib} --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib2} --publishable=true --importPath=@${proj}/${childLib2} --no-interactive`
          );

          // create secondary entrypoint
          updateFile(
            `libs/${childLib}/sub/package.json`,
            `
          {
            "ngPackage": {}
          }
        `
          );
          updateFile(
            `libs/${childLib}/sub/src/lib/sub.module.ts`,
            `
          import { NgModule } from '@angular/core';
          import { CommonModule } from '@angular/common';
          @NgModule({ imports: [CommonModule] })
          export class SubModule {}
        `
          );

          updateFile(
            `libs/${childLib}/sub/src/public_api.ts`,
            `export * from './lib/sub.module';`
          );

          updateFile(
            `libs/${childLib}/sub/src/index.ts`,
            `export * from './public_api';`
          );

          updateFile(`tsconfig.base.json`, (s) => {
            return s.replace(
              `"@${proj}/${childLib}": ["libs/${childLib}/src/index.ts"],`,
              `"@${proj}/${childLib}": ["libs/${childLib}/src/index.ts"],
      "@${proj}/${childLib}/sub": ["libs/${childLib}/sub/src/index.ts"],
        `
            );
          });
        }

        // create dependencies by importing
        const createDep = (parent, children: string[]) => {
          let moduleContent = `
              import { NgModule } from '@angular/core';
              import { CommonModule } from '@angular/common';
              ${children
                .map(
                  (entry) =>
                    `import { ${
                      names(entry).className
                    }Module } from '@${proj}/${entry}';`
                )
                .join('\n')}
            `;

          if (testConfig === 'publishable') {
            moduleContent += `
              import { SubModule } from '@${proj}/${childLib}/sub';

              @NgModule({
                imports: [CommonModule, ${children
                  .map((entry) => `${names(entry).className}Module`)
                  .join(',')}, SubModule]
              })
              export class ${names(parent).className}Module {}`;
          }

          updateFile(
            `libs/${parent}/src/lib/${parent}.module.ts`,
            moduleContent
          );
        };

        createDep(parentLib, [childLib, childLib2]);
      });

      afterEach(() => removeProject({ onlyOnCI: true }));

      it('should build properly and update the parent package.json with the dependencies', () => {
        runCLI(`build ${childLib}`);
        runCLI(`build ${childLib2}`);
        runCLI(`build ${parentLib}`);

        checkFilesExist(
          `dist/libs/${childLib}/package.json`,
          `dist/libs/${childLib2}/package.json`,
          `dist/libs/${parentLib}/package.json`
        );

        const jsonFile = readJson(`dist/libs/${parentLib}/package.json`);

        expect(jsonFile.dependencies['tslib']).toMatch(/\^2\.\d+\.\d+/); // match any ^2.x.x
        expect(jsonFile.peerDependencies[`@${proj}/${childLib}`]).toBeDefined();
        expect(
          jsonFile.peerDependencies[`@${proj}/${childLib2}`]
        ).toBeDefined();
        expect(jsonFile.peerDependencies['@angular/common']).toBeDefined();
        expect(jsonFile.peerDependencies['@angular/core']).toBeDefined();
      });
    });
  });

  describe('Publishable library secondary entry point', () => {
    let project: string;
    let lib: string;
    let entryPoint: string;

    beforeEach(() => {
      project = newProject();
      lib = uniq('lib');
      entryPoint = uniq('entrypoint');

      runCLI(
        `generate @nrwl/angular:lib ${lib} --publishable --importPath=@${project}/${lib} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
      );
    });

    it('should build successfully', () => {
      const buildOutput = runCLI(`build ${lib}`);

      expect(buildOutput).toContain(
        `Building entry point '@${project}/${lib}'`
      );
      expect(buildOutput).toContain(
        `Building entry point '@${project}/${lib}/${entryPoint}'`
      );
      expect(buildOutput).toContain('Running target "build" succeeded');
    });
  });

  describe('Tailwind support', () => {
    let projectScope: string;
    let buildLibExecutorOption: string;
    let buildLibProjectConfig: string;
    let buildLibRootConfig: string;
    let pubLibExecutorOption: string;
    let pubLibProjectConfig: string;
    let pubLibRootConfig: string;

    const customTailwindConfigFile = 'custom-tailwind.config.js';

    const spacing = {
      rootConfig: {
        sm: '2px',
        md: '4px',
        lg: '8px',
      },
      projectConfig: {
        sm: '1px',
        md: '2px',
        lg: '4px',
      },
      executorOption: {
        sm: '4px',
        md: '8px',
        lg: '16px',
      },
    };

    const createWorkspaceTailwindConfigFile = () => {
      const tailwindConfigFile = 'tailwind.config.js';

      const tailwindConfig = `module.exports = {
        mode: 'jit',
        purge: ['./apps/**/*.{html,ts}', './libs/**/*.{html,ts}'],
        darkMode: false,
        theme: {
          spacing: {
            sm: '${spacing.rootConfig.sm}',
            md: '${spacing.rootConfig.md}',
            lg: '${spacing.rootConfig.lg}',
          },
        },
        variants: { extend: {} },
        plugins: [],
      };
      `;

      updateFile(tailwindConfigFile, tailwindConfig);
    };

    const createTailwindConfigFile = (
      dir: string,
      lib: string,
      libSpacing: typeof spacing['executorOption'],
      tailwindConfigFile = 'tailwind.config.js'
    ) => {
      const tailwindConfigFilePath = join(dir, tailwindConfigFile);

      const tailwindConfig = `const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');

      module.exports = {
        mode: 'jit',
        purge: [
          './libs/${lib}/src/**/*.{html,ts}',
          ...createGlobPatternsForDependencies(__dirname),
        ],
        darkMode: false,
        theme: {
          spacing: {
            sm: '${libSpacing.sm}',
            md: '${libSpacing.md}',
            lg: '${libSpacing.lg}',
          },
        },
        variants: { extend: {} },
        plugins: [],
      };
      `;

      updateFile(tailwindConfigFilePath, tailwindConfig);
    };

    const addTailwindConfigToProject = (lib: string) => {
      const angularJson = readJson('angular.json');
      angularJson.projects[
        lib
      ].architect.build.options.tailwindConfig = `libs/${lib}/${customTailwindConfigFile}`;
      updateFile('angular.json', JSON.stringify(angularJson, null, 2));
    };

    const createLibComponent = (lib: string) => {
      updateFile(
        `libs/${lib}/src/lib/foo.component.ts`,
        `import { Component } from '@angular/core';

        @Component({
          selector: '${projectScope}-foo',
          template: '<button class="custom-btn">Click me!</button>',
          styles: [\`
            .custom-btn {
              @apply m-md p-sm;
            }
          \`]
        })
        export class FooComponent {}
      `
      );

      updateFile(
        `libs/${lib}/src/lib/${lib}.module.ts`,
        `import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        import { FooComponent } from './foo.component';
        
        @NgModule({
          imports: [CommonModule],
          declarations: [FooComponent],
          exports: [FooComponent],
        })
        export class LibModule {}
      `
      );

      updateFile(
        `libs/${lib}/src/index.ts`,
        `export * from './lib/foo.component';
        export * from './lib/${lib}.module';
        `
      );
    };

    beforeEach(() => {
      const projectName = uniq('proj');

      projectScope = newProject({ name: projectName });
      buildLibExecutorOption = uniq('build-lib-executor-option');
      buildLibProjectConfig = uniq('build-lib-project-config');
      buildLibRootConfig = uniq('build-lib-root-config');
      pubLibExecutorOption = uniq('pub-lib-executor-option');
      pubLibProjectConfig = uniq('pub-lib-project-config');
      pubLibRootConfig = uniq('pub-lib-root-config');

      // Install Tailwind required packages.
      // TODO: Remove this when Tailwind generator is created and used.
      packageInstall('tailwindcss postcss autoprefixer', projectName, 'latest');

      // Create Tailwind config in the workspace root.
      createWorkspaceTailwindConfigFile();

      // Setup buildable libs

      // Buildable lib with tailwind config specified in the project config
      runCLI(
        `generate @nrwl/angular:lib ${buildLibExecutorOption} --buildable --no-interactive`
      );
      createLibComponent(buildLibExecutorOption);
      createTailwindConfigFile(
        `libs/${buildLibExecutorOption}`,
        buildLibExecutorOption,
        spacing.executorOption,
        customTailwindConfigFile
      );
      addTailwindConfigToProject(buildLibExecutorOption);

      // Buildable lib with tailwind config located in the project root
      runCLI(
        `generate @nrwl/angular:lib ${buildLibProjectConfig} --buildable --no-interactive`
      );
      createLibComponent(buildLibProjectConfig);
      createTailwindConfigFile(
        `libs/${buildLibProjectConfig}`,
        buildLibProjectConfig,
        spacing.projectConfig
      );

      // Buildable lib with tailwind config located in the workspace root
      runCLI(
        `generate @nrwl/angular:lib ${buildLibRootConfig} --buildable --no-interactive`
      );
      createLibComponent(buildLibRootConfig);

      // Publishable libs

      // Publishable lib with tailwind config specified in the project config
      runCLI(
        `generate @nrwl/angular:lib ${pubLibExecutorOption} --publishable --importPath=@${projectScope}/${pubLibExecutorOption} --no-interactive`
      );
      createLibComponent(pubLibExecutorOption);
      createTailwindConfigFile(
        `libs/${pubLibExecutorOption}`,
        pubLibExecutorOption,
        spacing.executorOption,
        customTailwindConfigFile
      );
      addTailwindConfigToProject(pubLibExecutorOption);

      // Publishable lib with tailwind config located in the project root
      runCLI(
        `generate @nrwl/angular:lib ${pubLibProjectConfig} --publishable --importPath=@${projectScope}/${pubLibProjectConfig} --no-interactive`
      );
      createLibComponent(pubLibProjectConfig);
      createTailwindConfigFile(
        `libs/${pubLibProjectConfig}`,
        pubLibProjectConfig,
        spacing.projectConfig
      );

      // Publishable lib with tailwind config located in the workspace root
      runCLI(
        `generate @nrwl/angular:lib ${pubLibRootConfig} --publishable --importPath=@${projectScope}/${pubLibRootConfig} --no-interactive`
      );
      createLibComponent(pubLibRootConfig);
    });

    const assertComponentStyles = (
      lib: string,
      libSpacing: typeof spacing['executorOption']
    ) => {
      const builtComponentContent = readFile(
        `dist/libs/${lib}/esm2020/lib/foo.component.mjs`
      );
      let expectedStylesRegex = new RegExp(
        `styles: \\[\\"\\.custom\\-btn(\\[_ngcontent\\-%COMP%\\])?{margin:${libSpacing.md};padding:${libSpacing.sm}}(\\\\n)?\\"\\]`
      );
      expect(builtComponentContent).toMatch(expectedStylesRegex);
    };

    it('should build and output the right styles based on the tailwind config', () => {
      runCLI(`build ${buildLibExecutorOption}`);
      assertComponentStyles(buildLibExecutorOption, spacing.executorOption);

      runCLI(`build ${buildLibProjectConfig}`);
      assertComponentStyles(buildLibProjectConfig, spacing.projectConfig);

      runCLI(`build ${buildLibRootConfig}`);
      assertComponentStyles(buildLibRootConfig, spacing.rootConfig);

      runCLI(`build ${pubLibExecutorOption}`);
      assertComponentStyles(pubLibExecutorOption, spacing.executorOption);

      runCLI(`build ${pubLibProjectConfig}`);
      assertComponentStyles(pubLibProjectConfig, spacing.projectConfig);

      runCLI(`build ${pubLibRootConfig}`);
      assertComponentStyles(pubLibRootConfig, spacing.rootConfig);
    });
  });
});
