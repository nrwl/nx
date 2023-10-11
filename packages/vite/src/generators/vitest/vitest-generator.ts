import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import {
  addOrChangeTestTarget,
  createOrEditViteConfig,
  findExistingTargetsInProject,
} from '../../utils/generator-utils';
import { VitestGeneratorSchema } from './schema';

import initGenerator from '../init/init';
import {
  vitestCoverageC8Version,
  vitestCoverageIstanbulVersion,
  vitestCoverageV8Version,
} from '../../utils/versions';

import { addTsLibDependencies } from '@nx/js';
import { join } from 'path';

export async function vitestGenerator(
  tree: Tree,
  schema: VitestGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  const { targets, root, projectType } = readProjectConfiguration(
    tree,
    schema.project
  );
  let testTarget =
    schema.testTarget ??
    findExistingTargetsInProject(targets).validFoundTargetName.test ??
    'test';

  addOrChangeTestTarget(tree, schema, testTarget);

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
    testEnvironment: schema.testEnvironment,
  });
  tasks.push(initTask);

  if (!schema.skipViteConfig) {
    if (schema.uiFramework === 'react') {
      createOrEditViteConfig(
        tree,
        {
          project: schema.project,
          includeLib: projectType === 'library',
          includeVitest: true,
          inSourceTests: schema.inSourceTests,
          rollupOptionsExternal: [
            `'react'`,
            `'react-dom'`,
            `'react/jsx-runtime'`,
          ],
          rollupOptionsExternalString: `"'react', 'react-dom', 'react/jsx-runtime'"`,
          imports: [`import react from '@vitejs/plugin-react'`],
          plugins: ['react()'],
        },
        true
      );
    } else {
      createOrEditViteConfig(
        tree,
        {
          ...schema,
          includeVitest: true,
          includeLib: projectType === 'library',
        },
        true
      );
    }
  }

  createFiles(tree, schema, root);
  updateTsConfig(tree, schema, root);

  const coverageProviderDependency = getCoverageProviderDependency(
    schema.coverageProvider
  );

  const installCoverageProviderTask = addDependenciesToPackageJson(
    tree,
    {},
    coverageProviderDependency
  );
  tasks.push(installCoverageProviderTask);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function updateTsConfig(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  if (tree.exists(joinPathFragments(projectRoot, 'tsconfig.spec.json'))) {
    updateJson(
      tree,
      joinPathFragments(projectRoot, 'tsconfig.spec.json'),
      (json) => {
        if (!json.compilerOptions?.types?.includes('vitest')) {
          if (json.compilerOptions?.types) {
            json.compilerOptions.types.push('vitest');
          } else {
            json.compilerOptions ??= {};
            json.compilerOptions.types = ['vitest'];
          }
        }
        return json;
      }
    );

    updateJson(
      tree,
      joinPathFragments(projectRoot, 'tsconfig.json'),
      (json) => {
        if (
          json.references &&
          !json.references.some((r) => r.path === './tsconfig.spec.json')
        ) {
          json.references.push({
            path: './tsconfig.spec.json',
          });
        }
        return json;
      }
    );
  } else {
    updateJson(
      tree,
      joinPathFragments(projectRoot, 'tsconfig.json'),
      (json) => {
        if (!json.compilerOptions?.types?.includes('vitest')) {
          if (json.compilerOptions?.types) {
            json.compilerOptions.types.push('vitest');
          } else {
            json.compilerOptions ??= {};
            json.compilerOptions.types = ['vitest'];
          }
        }
        return json;
      }
    );
  }

  if (options.inSourceTests) {
    const tsconfigLibPath = joinPathFragments(projectRoot, 'tsconfig.lib.json');
    const tsconfigAppPath = joinPathFragments(projectRoot, 'tsconfig.app.json');
    if (tree.exists(tsconfigLibPath)) {
      updateJson(
        tree,
        joinPathFragments(projectRoot, 'tsconfig.lib.json'),
        (json) => {
          (json.compilerOptions.types ??= []).push('vitest/importMeta');
          return json;
        }
      );
    } else if (tree.exists(tsconfigAppPath)) {
      updateJson(
        tree,
        joinPathFragments(projectRoot, 'tsconfig.app.json'),
        (json) => {
          (json.compilerOptions.types ??= []).push('vitest/importMeta');
          return json;
        }
      );
    }

    addTsLibDependencies(tree);
  }
}

function createFiles(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  generateFiles(tree, join(__dirname, 'files'), projectRoot, {
    tmpl: '',
    ...options,
    projectRoot,
    offsetFromRoot: offsetFromRoot(projectRoot),
  });
}

function getCoverageProviderDependency(
  coverageProvider: VitestGeneratorSchema['coverageProvider']
) {
  switch (coverageProvider) {
    case 'c8':
      return {
        '@vitest/coverage-c8': vitestCoverageC8Version,
      };
    case 'istanbul':
      return {
        '@vitest/coverage-istanbul': vitestCoverageIstanbulVersion,
      };
    default:
      return {
        '@vitest/coverage-v8': vitestCoverageV8Version,
      };
  }
}

export default vitestGenerator;
