import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
} from '@nx/devkit';
import { extractTsConfigBase } from '@nx/js/src/utils/typescript/create-ts-config';
import {
  eslintVersion,
  isbotVersion,
  reactDomVersion,
  reactVersion,
  remixVersion,
  typescriptVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../utils/versions';
import { normalizeOptions, addE2E, addLint, addUnitTest } from './lib';
import { NxRemixGeneratorSchema } from './schema';
import { updateDependencies } from '../utils/update-dependencies';
import initGenerator from '../init/init';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { updateJestTestMatch } from '../../utils/testing-config-utils';

export function remixApplicationGenerator(
  tree: Tree,
  options: NxRemixGeneratorSchema
) {
  return remixApplicationGeneratorInternal(tree, {
    addPlugin: false,
    ...options,
  });
}

export async function remixApplicationGeneratorInternal(
  tree: Tree,
  _options: NxRemixGeneratorSchema
) {
  const options = await normalizeOptions(tree, _options);
  const tasks: GeneratorCallback[] = [
    await initGenerator(tree, {
      skipFormat: true,
      addPlugin: options.addPlugin,
    }),
    await jsInitGenerator(tree, { skipFormat: true }),
  ];

  addBuildTargetDefaults(tree, '@nx/remix:build');

  addProjectConfiguration(tree, options.projectName, {
    root: options.projectRoot,
    sourceRoot: `${options.projectRoot}`,
    projectType: 'application',
    tags: options.parsedTags,
    targets: !options.addPlugin
      ? {
          build: {
            executor: '@nx/remix:build',
            outputs: ['{options.outputPath}'],
            options: {
              outputPath: joinPathFragments('dist', options.projectRoot),
            },
          },
          serve: {
            executor: `@nx/remix:serve`,
            options: {
              command: `${
                getPackageManagerCommand().exec
              } remix-serve build/index.js`,
              manual: true,
              port: 4200,
            },
          },
          start: {
            dependsOn: ['build'],
            command: `remix-serve build/index.js`,
            options: {
              cwd: options.projectRoot,
            },
          },
          typecheck: {
            command: `tsc --project tsconfig.app.json`,
            options: {
              cwd: options.projectRoot,
            },
          },
        }
      : {},
  });

  const installTask = updateDependencies(tree);
  tasks.push(installTask);

  const vars = {
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    remixVersion,
    isbotVersion,
    reactVersion,
    reactDomVersion,
    typesReactVersion,
    typesReactDomVersion,
    eslintVersion,
    typescriptVersion,
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files/common'),
    options.projectRoot,
    vars
  );

  if (options.rootProject) {
    const gitignore = tree.read('.gitignore', 'utf-8');
    tree.write(
      '.gitignore',
      `${gitignore}\n.cache\nbuild\npublic/build\n.env\n`
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files/integrated'),
      options.projectRoot,
      vars
    );
  }

  if (options.unitTestRunner !== 'none') {
    tasks.push(...(await addUnitTest(tree, options)));
  } else {
    tree.delete(
      joinPathFragments(options.projectRoot, `tests/routes/_index.spec.tsx`)
    );
  }

  if (options.linter !== 'none') {
    tasks.push(await addLint(tree, options));
  }

  if (options.js) {
    toJS(tree);
  }

  if (options.rootProject && tree.exists('tsconfig.base.json')) {
    // If this is a standalone project, merge tsconfig.json and tsconfig.base.json.
    const tsConfigBaseJson = readJson(tree, 'tsconfig.base.json');
    updateJson(tree, 'tsconfig.json', (json) => {
      delete json.extends;
      json.compilerOptions = {
        ...tsConfigBaseJson.compilerOptions,
        ...json.compilerOptions,
        // Taken from remix default setup
        // https://github.com/remix-run/remix/blob/68c8982/templates/remix/tsconfig.json#L15-L17
        paths: {
          '~/*': ['./app/*'],
        },
      };
      json.include = [
        ...(tsConfigBaseJson.include ?? []),
        ...(json.include ?? []),
      ];
      json.exclude = [
        ...(tsConfigBaseJson.exclude ?? []),
        ...(json.exclude ?? []),
      ];
      return json;
    });
    tree.delete('tsconfig.base.json');
  } else {
    // Otherwise, extract the tsconfig.base.json from tsconfig.json so we can share settings.
    extractTsConfigBase(tree);
  }

  if (options.rootProject) {
    updateJson(tree, `package.json`, (json) => {
      json.type = 'module';
      return json;
    });

    if (options.unitTestRunner === 'jest') {
      tree.write(
        'jest.preset.js',
        `import { nxPreset } from '@nx/jest/preset/jest-preset.js';
export default {...nxPreset};
`
      );

      updateJestTestMatch(
        tree,
        'jest.config.ts',
        '<rootDir>/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
      );
    }
  }

  tasks.push(await addE2E(tree, options));

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default remixApplicationGenerator;
