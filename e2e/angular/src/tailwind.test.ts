import {
  cleanupProject,
  listFiles,
  newProject,
  readFile,
  removeFile,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

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
      content: [
        '**/!(*.stories|*.spec).{ts,html}',
        '**/!(*.stories|*.spec).{ts,html}',
      ],
      theme: {
        spacing: {
          sm: '${spacing.root.sm}',
          md: '${spacing.root.md}',
          lg: '${spacing.root.lg}',
        },
      },
      plugins: [],
    };
    `;

    updateFile(tailwindConfigFile, tailwindConfig);
  };

  const createTailwindConfigFile = (
    tailwindConfigFile = 'tailwind.config.js',
    libSpacing: (typeof spacing)['projectVariant1']
  ) => {
    const tailwindConfig = `const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
    const { join } = require('path');
  
    module.exports = {
      content: [
        join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
        ...createGlobPatternsForDependencies(__dirname),
      ],
      theme: {
        spacing: {
          sm: '${libSpacing.sm}',
          md: '${libSpacing.md}',
          lg: '${libSpacing.lg}',
        },
      },
      plugins: [],
    };
    `;

    updateFile(tailwindConfigFile, tailwindConfig);
  };

  const updateTailwindConfig = (
    tailwindConfigPath: string,
    projectSpacing: (typeof spacing)['root']
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
    project = newProject({ packages: ['@nx/angular'] });

    // Create tailwind config in the workspace root
    createWorkspaceTailwindConfigFile();
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('Libraries', () => {
    const createLibComponent = (
      lib: string,
      buttonBgColor: string = defaultButtonBgColor
    ) => {
      updateFile(
        `${lib}/src/lib/foo.component.ts`,
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
        `${lib}/src/lib/${lib}.module.ts`,
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
        `${lib}/src/index.ts`,
        `export * from './lib/foo.component';
        export * from './lib/${lib}.module';
        `
      );
    };

    const assertLibComponentStyles = (
      lib: string,
      libSpacing: (typeof spacing)['root']
    ) => {
      const builtComponentContent = readFile(
        `dist/${lib}/esm2022/lib/foo.component.mjs`
      );
      let expectedStylesRegex = new RegExp(
        `styles: \\[\\"\\.custom\\-btn(\\[_ngcontent\\-%COMP%\\])?{margin:${libSpacing.md};padding:${libSpacing.sm}}(\\\\n)?\\"\\]`
      );

      expect(builtComponentContent).toMatch(expectedStylesRegex);
    };

    it('should generate a buildable library with tailwind and build correctly', () => {
      runCLI(
        `generate @nx/angular:lib ${buildLibWithTailwind.name} --buildable --add-tailwind --project-name-and-root-format=as-provided --no-interactive`
      );
      updateTailwindConfig(
        `${buildLibWithTailwind.name}/tailwind.config.js`,
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
        `generate @nx/angular:lib ${buildLibSetupTailwind} --buildable --project-name-and-root-format=as-provided --no-interactive`
      );
      runCLI(
        `generate @nx/angular:setup-tailwind ${buildLibSetupTailwind} --no-interactive`
      );
      updateTailwindConfig(
        `${buildLibSetupTailwind}/tailwind.config.js`,
        spacing.projectVariant2
      );
      createLibComponent(buildLibSetupTailwind);

      runCLI(`build ${buildLibSetupTailwind}`);

      assertLibComponentStyles(buildLibSetupTailwind, spacing.projectVariant2);
    });

    it('should correctly build a buildable library with a tailwind.config.js file in the project root or workspace root', () => {
      const buildLibNoProjectConfig = uniq('build-lib-no-project-config');
      runCLI(
        `generate @nx/angular:lib ${buildLibNoProjectConfig} --buildable --project-name-and-root-format=as-provided --no-interactive`
      );
      createTailwindConfigFile(
        `${buildLibNoProjectConfig}/tailwind.config.js`,
        spacing.projectVariant3
      );
      createLibComponent(buildLibNoProjectConfig);

      runCLI(`build ${buildLibNoProjectConfig}`);

      assertLibComponentStyles(
        buildLibNoProjectConfig,
        spacing.projectVariant3
      );

      // remove tailwind.config.js file from the project root to test the one in the workspace root
      removeFile(`${buildLibNoProjectConfig}/tailwind.config.js`);

      runCLI(`build ${buildLibNoProjectConfig}`);

      assertLibComponentStyles(buildLibNoProjectConfig, spacing.root);
    });

    it('should generate a publishable library with tailwind and build correctly', () => {
      runCLI(
        `generate @nx/angular:lib ${pubLibWithTailwind.name} --publishable --add-tailwind --importPath=@${project}/${pubLibWithTailwind.name} --project-name-and-root-format=as-provided --no-interactive`
      );
      updateTailwindConfig(
        `${pubLibWithTailwind.name}/tailwind.config.js`,
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
        `generate @nx/angular:lib ${pubLibSetupTailwind} --publishable --importPath=@${project}/${pubLibSetupTailwind} --project-name-and-root-format=as-provided --no-interactive`
      );
      runCLI(
        `generate @nx/angular:setup-tailwind ${pubLibSetupTailwind} --no-interactive`
      );
      updateTailwindConfig(
        `${pubLibSetupTailwind}/tailwind.config.js`,
        spacing.projectVariant2
      );
      createLibComponent(pubLibSetupTailwind);

      runCLI(`build ${pubLibSetupTailwind}`);

      assertLibComponentStyles(pubLibSetupTailwind, spacing.projectVariant2);
    });

    it('should correctly build a publishable library with a tailwind.config.js file in the project root or workspace root', () => {
      const pubLibNoProjectConfig = uniq('pub-lib-no-project-config');
      runCLI(
        `generate @nx/angular:lib ${pubLibNoProjectConfig} --publishable --importPath=@${project}/${pubLibNoProjectConfig} --project-name-and-root-format=as-provided --no-interactive`
      );
      createTailwindConfigFile(
        `${pubLibNoProjectConfig}/tailwind.config.js`,
        spacing.projectVariant3
      );
      createLibComponent(pubLibNoProjectConfig);

      runCLI(`build ${pubLibNoProjectConfig}`);

      assertLibComponentStyles(pubLibNoProjectConfig, spacing.projectVariant3);

      // remove tailwind.config.js file from the project root to test the one in the workspace root
      removeFile(`${pubLibNoProjectConfig}/tailwind.config.js`);

      runCLI(`build ${pubLibNoProjectConfig}`);

      assertLibComponentStyles(pubLibNoProjectConfig, spacing.root);
    });
  });

  describe('Applications', () => {
    const readAppStylesBundle = (outputPath: string) => {
      const stylesBundlePath = listFiles(outputPath).find((file) =>
        /^styles[\.-]/.test(file)
      );
      const stylesBundle = readFile(`${outputPath}/${stylesBundlePath}`);

      return stylesBundle;
    };

    const assertAppComponentStyles = (
      outputPath: string,
      appSpacing: (typeof spacing)['root']
    ) => {
      const mainBundlePath = listFiles(outputPath).find((file) =>
        /^main[\.-]/.test(file)
      );
      const mainBundle = readFile(`${outputPath}/${mainBundlePath}`);
      let expectedStylesRegex = new RegExp(
        `styles:\\[\\"\\.custom\\-btn\\[_ngcontent\\-%COMP%\\]{margin:${appSpacing.md};padding:${appSpacing.sm}}\\"\\]`
      );

      expect(mainBundle).toMatch(expectedStylesRegex);
    };

    const setupTailwindAndProjectDependencies = (appName: string) => {
      updateTailwindConfig(
        `${appName}/tailwind.config.js`,
        spacing.projectVariant1
      );
      updateFile(
        `${appName}/src/app/app.module.ts`,
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
      updateFile(
        `${appName}/src/app/app.component.html`,
        `<button class="custom-btn text-white">Click me!</button>`
      );

      updateFile(
        `${appName}/src/app/app.component.css`,
        `.custom-btn {
          @apply m-md p-sm;
        }`
      );
    };

    it('should build correctly and only output the tailwind utilities used', async () => {
      const appWithTailwind = uniq('app-with-tailwind');
      runCLI(
        `generate @nx/angular:app ${appWithTailwind} --add-tailwind --project-name-and-root-format=as-provided --no-interactive`
      );
      setupTailwindAndProjectDependencies(appWithTailwind);

      runCLI(`build ${appWithTailwind}`);

      const outputPath = `dist/${appWithTailwind}/browser`;
      assertAppComponentStyles(outputPath, spacing.projectVariant1);
      let stylesBundle = readAppStylesBundle(outputPath);
      expect(stylesBundle).toContain('.text-white');
      expect(stylesBundle).not.toContain('.text-black');
      expect(stylesBundle).toContain(`.${buildLibWithTailwind.buttonBgColor}`);
      expect(stylesBundle).toContain(`.${pubLibWithTailwind.buttonBgColor}`);
      expect(stylesBundle).not.toContain(`.${defaultButtonBgColor}`);
    });

    it('should build correctly and only output the tailwind utilities used when using webpack and incremental builds', async () => {
      const appWithTailwind = uniq('app-with-tailwind');
      runCLI(
        `generate @nx/angular:app ${appWithTailwind} --add-tailwind --bundler=webpack --project-name-and-root-format=as-provided --no-interactive`
      );
      setupTailwindAndProjectDependencies(appWithTailwind);
      updateJson(join(appWithTailwind, 'project.json'), (config) => {
        config.targets.build.executor = '@nx/angular:webpack-browser';
        config.targets.build.options = {
          ...config.targets.build.options,
          buildLibsFromSource: false,
        };
        return config;
      });

      runCLI(`build ${appWithTailwind}`);

      const outputPath = `dist/${appWithTailwind}`;
      assertAppComponentStyles(outputPath, spacing.projectVariant1);
      let stylesBundle = readAppStylesBundle(outputPath);
      expect(stylesBundle).toContain('.text-white');
      expect(stylesBundle).not.toContain('.text-black');
      expect(stylesBundle).toContain(`.${buildLibWithTailwind.buttonBgColor}`);
      expect(stylesBundle).toContain(`.${pubLibWithTailwind.buttonBgColor}`);
      expect(stylesBundle).not.toContain(`.${defaultButtonBgColor}`);
    });
  });
});
