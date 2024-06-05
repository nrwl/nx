import { Tree } from 'nx/src/generators/tree';
import { lintProjectGenerator, Linter } from '@nx/eslint';
import { joinPathFragments } from 'nx/src/utils/path';
import {
  GeneratorCallback,
  addDependenciesToPackageJson,
  runTasksInSerial,
  updateJson,
} from '@nx/devkit';
import { editEslintConfigFiles } from '@nx/vue';
import { nuxtEslintConfigVersion } from './versions';

export async function addLinting(
  host: Tree,
  options: {
    linter: Linter;
    projectName: string;
    projectRoot: string;
    unitTestRunner?: 'vitest' | 'none';
    rootProject?: boolean;
  }
) {
  const tasks: GeneratorCallback[] = [];
  if (options.linter === 'eslint') {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [joinPathFragments(options.projectRoot, 'tsconfig.json')],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
      addPlugin: true,
    });
    tasks.push(lintTask);

    editEslintConfigFiles(host, options.projectRoot);

    updateJson(
      host,
      joinPathFragments(options.projectRoot, '.eslintrc.json'),
      (json) => {
        const {
          extends: pluginExtends,
          ignorePatterns: pluginIgnorePatters,
          ...config
        } = json;

        return {
          extends: ['@nuxt/eslint-config', ...(pluginExtends || [])],
          ignorePatterns: [
            ...(pluginIgnorePatters || []),
            '.nuxt/**',
            '.output/**',
            'node_modules',
          ],
          ...config,
        };
      }
    );

    const installTask = addDependenciesToPackageJson(
      host,
      {},
      {
        '@nuxt/eslint-config': nuxtEslintConfigVersion,
      }
    );
    tasks.push(installTask);
  }
  return runTasksInSerial(...tasks);
}
