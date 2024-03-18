import {
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import { loadNuxtKitDynamicImport } from '../../utils/executor-utils';
import { basename } from 'path';

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const project of projects.values()) {
    const nuxtConfigPath = findNuxtConfig(tree, project.root);

    if (!nuxtConfigPath) {
      continue;
    }

    const nuxtConfig = await getInfoFromNuxtConfig(
      nuxtConfigPath,
      project.root
    );

    const buildDir = nuxtConfig.buildDir ?? '.nuxt';

    const tsConfigPath = joinPathFragments(project.root, 'tsconfig.json');

    if (tree.exists(tsConfigPath)) {
      updateJson(tree, tsConfigPath, (json) => {
        if (!json.include) {
          json.include = [];
        }

        if (!json.include.includes(buildDir + '/nuxt.d.ts')) {
          json.include.push(buildDir + '/nuxt.d.ts');
        }

        return json;
      });
    }
  }

  await formatFiles(tree);
}

function findNuxtConfig(tree: Tree, projectRoot: string): string | undefined {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (tree.exists(joinPathFragments(projectRoot, `nuxt.config.${ext}`))) {
      return joinPathFragments(projectRoot, `nuxt.config.${ext}`);
    }
  }
}

async function getInfoFromNuxtConfig(
  configFilePath: string,
  projectRoot: string
): Promise<{
  buildDir: string;
}> {
  const { loadNuxtConfig } = await loadNuxtKitDynamicImport();

  const config = await loadNuxtConfig({
    cwd: joinPathFragments(workspaceRoot, projectRoot),
    configFile: basename(configFilePath),
  });

  return {
    buildDir: config?.buildDir,
  };
}
