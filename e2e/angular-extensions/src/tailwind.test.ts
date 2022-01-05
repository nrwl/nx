process.env.SELECTED_CLI = 'angular';

import {
  cleanupProject,
  listFiles,
  newProject,
  readFile,
  removeFile,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Tailwind support', () => {
  let project: string;

  const defaultButtonBgColor = 'bg-blue-700';

  const buildLibWithTailwind = {
    name: uniq('build-lib-with-tailwind'),
    buttonBgColor: 'bg-green-800',
  };
  const pubLibWithTailwind = {
    name: uniq('pub-lib-with-tailwind'),
    buttonBgColor: 'bg-red-900',
  };

  const spacing = {
    root: {
      sm: '2px',
      md: '4px',
      lg: '8px',
    },
    projectVariant1: {
      sm: '1px',
      md: '2px',
      lg: '4px',
    },
    projectVariant2: {
      sm: '4px',
      md: '8px',
      lg: '16px',
    },
    projectVariant3: {
      sm: '8px',
      md: '16px',
      lg: '32px',
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
          sm: '${spacing.root.sm}',
          md: '${spacing.root.md}',
          lg: '${spacing.root.lg}',
        },
      },
      variants: { extend: {} },
      plugins: [],
    };
    `;

    updateFile(tailwindConfigFile, tailwindConfig);
  };

  const createTailwindConfigFile = (
    tailwindConfigFile = 'tailwind.config.js',
    libSpacing: typeof spacing['projectVariant1']
  ) => {
    const tailwindConfig = `const { createGlobPatternsForDependencies } = require('@nrwl/angular/tailwind');
    const { join } = require('path');
  
    module.exports = {
      mode: 'jit',
      purge: [
        join(__dirname, 'src/**/*.{html,ts}'),
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

    updateFile(tailwindConfigFile, tailwindConfig);
  };

  const updateTailwindConfig = (
    tailwindConfigPath: string,
    projectSpacing: typeof spacing['root']
  ) => {
    const tailwindConfig = readFile(tailwindConfigPath);

    const tailwindConfigUpdated = tailwindConfig.replace(
      'theme: {',
      `theme: {
        spacing: {
          sm: '${projectSpacing.sm}',
          md: '${projectSpacing.md}',
          lg: '${projectSpacing.lg}',
        },`
    );

    updateFile(tailwindConfigPath, tailwindConfigUpdated);
  };

  beforeAll(() => {
    project = newProject();

    // Create tailwind config in the workspace root
    createWorkspaceTailwindConfigFile();
  });

  afterAll(() => cleanupProject());

  describe('Libraries', () => {
    const createLibComponent = (
      lib: string,
      buttonBgColor: string = defaultButtonBgColor
    ) => {
      updateFile(
        `libs/${lib}/src/lib/foo.component.ts`,
        `import { Component } from '@angular/core';
  
        @Component({
          selector: '${project}-foo',
          template: '<button class="custom-btn text-white ${buttonBgColor}">Click me!</button>',
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

    const assertLibComponentStyles = (
      lib: string,
      libSpacing: typeof spacing['root']
    ) => {
      const builtComponentContent = readFile(
        `dist/libs/${lib}/esm2020/lib/foo.component.mjs`
      );
      let expectedStylesRegex = new RegExp(
        `styles: \\[\\"\\.custom\\-btn(\\[_ngcontent\\-%COMP%\\])?{margin:${libSpacing.md};padding:${libSpacing.sm}}(\\\\n)?\\"\\]`
      );

      expect(builtComponentContent).toMatch(expectedStylesRegex);
    };

    it('should generate a buildable library with tailwind and build correctly', () => {
      runCLI(
        `generate @nrwl/angular:lib ${buildLibWithTailwind.name} --buildable --add-tailwind --no-interactive`
      );
      updateTailwindConfig(
        `libs/${buildLibWithTailwind.name}/tailwind.config.js`,
        spacing.projectVariant1
      );
      createLibComponent(
        buildLibWithTailwind.name,
        buildLibWithTailwind.buttonBgColor
      );

      runCLI(`build ${buildLibWithTailwind.name}`);

      assertLibComponentStyles(
        buildLibWithTailwind.name,
        spacing.projectVariant1
      );
    });

    it('should set up tailwind in a previously generated buildable library and build correctly', () => {
      const buildLibSetupTailwind = uniq('build-lib-setup-tailwind');
      runCLI(
        `generate @nrwl/angular:lib ${buildLibSetupTailwind} --buildable --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:setup-tailwind ${buildLibSetupTailwind} --no-interactive`
      );
      updateTailwindConfig(
        `libs/${buildLibSetupTailwind}/tailwind.config.js`,
        spacing.projectVariant2
      );
      createLibComponent(buildLibSetupTailwind);

      runCLI(`build ${buildLibSetupTailwind}`);

      assertLibComponentStyles(buildLibSetupTailwind, spacing.projectVariant2);
    });

    it('should correctly build a buildable library with a tailwind.config.js file in the project root or workspace root', () => {
      const buildLibNoProjectConfig = uniq('build-lib-no-project-config');
      runCLI(
        `generate @nrwl/angular:lib ${buildLibNoProjectConfig} --buildable --no-interactive`
      );
      createTailwindConfigFile(
        `libs/${buildLibNoProjectConfig}/tailwind.config.js`,
        spacing.projectVariant3
      );
      createLibComponent(buildLibNoProjectConfig);

      runCLI(`build ${buildLibNoProjectConfig}`);

      assertLibComponentStyles(
        buildLibNoProjectConfig,
        spacing.projectVariant3
      );

      // remove tailwind.config.js file from the project root to test the one in the workspace root
      removeFile(`libs/${buildLibNoProjectConfig}/tailwind.config.js`);

      runCLI(`build ${buildLibNoProjectConfig}`);

      assertLibComponentStyles(buildLibNoProjectConfig, spacing.root);
    });

    it('should generate a publishable library with tailwind and build correctly', () => {
      runCLI(
        `generate @nrwl/angular:lib ${pubLibWithTailwind.name} --publishable --add-tailwind --importPath=@${project}/${pubLibWithTailwind.name} --no-interactive`
      );
      updateTailwindConfig(
        `libs/${pubLibWithTailwind.name}/tailwind.config.js`,
        spacing.projectVariant1
      );
      createLibComponent(
        pubLibWithTailwind.name,
        pubLibWithTailwind.buttonBgColor
      );

      runCLI(`build ${pubLibWithTailwind.name}`);

      assertLibComponentStyles(
        pubLibWithTailwind.name,
        spacing.projectVariant1
      );
    });

    it('should set up tailwind in a previously generated publishable library and build correctly', () => {
      const pubLibSetupTailwind = uniq('pub-lib-setup-tailwind');
      runCLI(
        `generate @nrwl/angular:lib ${pubLibSetupTailwind} --publishable --importPath=@${project}/${pubLibSetupTailwind} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:setup-tailwind ${pubLibSetupTailwind} --no-interactive`
      );
      updateTailwindConfig(
        `libs/${pubLibSetupTailwind}/tailwind.config.js`,
        spacing.projectVariant2
      );
      createLibComponent(pubLibSetupTailwind);

      runCLI(`build ${pubLibSetupTailwind}`);

      assertLibComponentStyles(pubLibSetupTailwind, spacing.projectVariant2);
    });

    it('should correctly build a publishable library with a tailwind.config.js file in the project root or workspace root', () => {
      const pubLibNoProjectConfig = uniq('pub-lib-no-project-config');
      runCLI(
        `generate @nrwl/angular:lib ${pubLibNoProjectConfig} --publishable --importPath=@${project}/${pubLibNoProjectConfig} --no-interactive`
      );
      createTailwindConfigFile(
        `libs/${pubLibNoProjectConfig}/tailwind.config.js`,
        spacing.projectVariant3
      );
      createLibComponent(pubLibNoProjectConfig);

      runCLI(`build ${pubLibNoProjectConfig}`);

      assertLibComponentStyles(pubLibNoProjectConfig, spacing.projectVariant3);

      // remove tailwind.config.js file from the project root to test the one in the workspace root
      removeFile(`libs/${pubLibNoProjectConfig}/tailwind.config.js`);

      runCLI(`build ${pubLibNoProjectConfig}`);

      assertLibComponentStyles(pubLibNoProjectConfig, spacing.root);
    });
  });

  describe('Applications', () => {
    const updateAppComponent = (app: string) => {
      updateFile(
        `apps/${app}/src/app/app.component.html`,
        `<button class="custom-btn text-white">Click me!</button>`
      );

      updateFile(
        `apps/${app}/src/app/app.component.css`,
        `.custom-btn {
          @apply m-md p-sm;
        }`
      );
    };

    const readAppStylesBundle = (app: string) => {
      const stylesBundlePath = listFiles(`dist/apps/${app}`).find((file) =>
        file.startsWith('styles.')
      );
      const stylesBundle = readFile(`dist/apps/${app}/${stylesBundlePath}`);

      return stylesBundle;
    };

    const assertAppComponentStyles = (
      app: string,
      appSpacing: typeof spacing['root']
    ) => {
      const mainBundlePath = listFiles(`dist/apps/${app}`).find((file) =>
        file.startsWith('main.')
      );
      const mainBundle = readFile(`dist/apps/${app}/${mainBundlePath}`);
      let expectedStylesRegex = new RegExp(
        `styles:\\[\\"\\.custom\\-btn\\[_ngcontent\\-%COMP%\\]{margin:${appSpacing.md};padding:${appSpacing.sm}}\\"\\]`
      );

      expect(mainBundle).toMatch(expectedStylesRegex);
    };

    it('should build correctly and only output the tailwind utilities used', () => {
      const appWithTailwind = uniq('app-with-tailwind');
      runCLI(
        `generate @nrwl/angular:app ${appWithTailwind} --add-tailwind --no-interactive`
      );
      updateTailwindConfig(
        `apps/${appWithTailwind}/tailwind.config.js`,
        spacing.projectVariant1
      );
      updateFile(
        `apps/${appWithTailwind}/src/app/app.module.ts`,
        `import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { LibModule as LibModule1 } from '@${project}/${buildLibWithTailwind.name}';
        import { LibModule as LibModule2 } from '@${project}/${pubLibWithTailwind.name}';

        import { AppComponent } from './app.component';

        @NgModule({
          declarations: [AppComponent],
          imports: [BrowserModule, LibModule1, LibModule2],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
        `
      );
      updateAppComponent(appWithTailwind);

      runCLI(`build ${appWithTailwind}`);

      assertAppComponentStyles(appWithTailwind, spacing.projectVariant1);
      let stylesBundle = readAppStylesBundle(appWithTailwind);
      expect(stylesBundle).toContain('.text-white');
      expect(stylesBundle).not.toContain('.text-black');
      expect(stylesBundle).toContain(`.${buildLibWithTailwind.buttonBgColor}`);
      expect(stylesBundle).toContain(`.${pubLibWithTailwind.buttonBgColor}`);
      expect(stylesBundle).not.toContain(`.${defaultButtonBgColor}`);
    });
  });
});
