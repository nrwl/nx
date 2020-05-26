import { Rule } from '@angular-devkit/schematics';
import { generateProjectLint, updateWorkspaceInTree } from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import { NormalizedSchema } from '../schema';

export function addProject(options: NormalizedSchema): Rule {
  return updateWorkspaceInTree((json) => {
    const architect: { [key: string]: any } = {};

    architect.build = {
      builder: '@nrwl/web:build',
      options: {
        outputPath: join(normalize('dist'), options.appProjectRoot),
        index: join(options.appProjectRoot, 'src/index.html'),
        main: join(options.appProjectRoot, maybeJs(options, `src/main.tsx`)),
        polyfills: join(
          options.appProjectRoot,
          maybeJs(options, 'src/polyfills.ts')
        ),
        tsConfig: join(options.appProjectRoot, 'tsconfig.app.json'),
        assets: [
          join(options.appProjectRoot, 'src/favicon.ico'),
          join(options.appProjectRoot, 'src/assets'),
        ],
        styles:
          options.styledModule || !options.hasStyles
            ? []
            : [join(options.appProjectRoot, `src/styles.${options.style}`)],
        scripts: [],
        webpackConfig: '@nrwl/react/plugins/webpack',
      },
      configurations: {
        production: {
          fileReplacements: [
            {
              replace: join(
                options.appProjectRoot,
                maybeJs(options, `src/environments/environment.ts`)
              ),
              with: join(
                options.appProjectRoot,
                maybeJs(options, `src/environments/environment.prod.ts`)
              ),
            },
          ],
          optimization: true,
          outputHashing: 'all',
          sourceMap: false,
          extractCss: true,
          namedChunks: false,
          extractLicenses: true,
          vendorChunk: false,
          budgets: [
            {
              type: 'initial',
              maximumWarning: '2mb',
              maximumError: '5mb',
            },
          ],
        },
      },
    };

    architect.serve = {
      builder: '@nrwl/web:dev-server',
      options: {
        buildTarget: `${options.projectName}:build`,
      },
      configurations: {
        production: {
          buildTarget: `${options.projectName}:build:production`,
        },
      },
    };

    architect.lint = generateProjectLint(
      normalize(options.appProjectRoot),
      join(normalize(options.appProjectRoot), 'tsconfig.app.json'),
      options.linter
    );

    json.projects[options.projectName] = {
      root: options.appProjectRoot,
      sourceRoot: join(options.appProjectRoot, 'src'),
      projectType: 'application',
      schematics: {},
      architect,
    };

    json.defaultProject = json.defaultProject || options.projectName;

    return json;
  });
}

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}
