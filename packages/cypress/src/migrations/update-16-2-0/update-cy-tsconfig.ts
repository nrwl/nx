import {
  ProjectConfiguration,
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
  updateJson,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export async function normalizeCyTsConfigNames(tree: Tree) {
  const projects = getProjects(tree);

  forEachExecutorOptions(tree, '@nx/cypress:cypress', (_, projectName) => {
    const projectConfig = projects.get(projectName);
    const newTsConfigPath = joinPathFragments(
      projectConfig.root,
      'cypress',
      'tsconfig.json'
    );

    // if there is already a tsconfig.json in the cypress folder, then assume things are setup already
    if (!tree.exists(newTsConfigPath)) {
      moveProjectTsCyConfig(tree, projectConfig, newTsConfigPath);
      moveCyDirTsCyConfig(tree, projectConfig, newTsConfigPath);
      updateCyDirTsConfigReferences(tree, projectConfig);
    }
  });

  await formatFiles(tree);
}

function moveProjectTsCyConfig(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  newTsConfigPath: string
) {
  if (tree.exists(joinPathFragments(projectConfig.root, 'tsconfig.cy.json'))) {
    tree.rename(
      joinPathFragments(projectConfig.root, 'tsconfig.cy.json'),
      newTsConfigPath
    );
    updateJson(tree, newTsConfigPath, (json) => {
      json.extends = '../tsconfig.json';

      json.compilerOptions ??= {};
      json.compilerOptions = {
        ...json.compilerOptions,
        sourceMap: false,
        outDir: '../../../dist/out-tsc',
      };

      json.include ??= [];
      json.include = json.include.map((p) => {
        if (p.startsWith('cypress/')) {
          return p.replace('cypress/', '');
        }
        return `../${p}`;
      });
      return json;
    });
  }
}

function moveCyDirTsCyConfig(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  newTsConfigPath: string
) {
  if (
    tree.exists(
      joinPathFragments(projectConfig.root, 'cypress', 'tsconfig.cy.json')
    )
  ) {
    tree.rename(
      joinPathFragments(projectConfig.root, 'cypress', 'tsconfig.cy.json'),
      newTsConfigPath
    );
    updateJson(tree, newTsConfigPath, (json) => {
      json.compilerOptions ??= {};
      json.compilerOptions = {
        ...json.compilerOptions,
        sourceMap: false,
      };

      return json;
    });
  }
}

function updateCyDirTsConfigReferences(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  if (
    !tree.exists(
      joinPathFragments(projectConfig.root, 'cypress', 'tsconfig.json')
    )
  ) {
    return;
  }
  updateJson(
    tree,
    joinPathFragments(projectConfig.root, 'tsconfig.json'),
    (json) => {
      json.references ??= [];
      if (!json.references) {
        return json;
      }
      const cyFile = json.references.find((p) =>
        p.path.includes('tsconfig.cy.json')
      );

      if (cyFile) {
        json.references.splice(json.references.indexOf(cyFile), 1);
      }

      if (!json.references.some((r) => r.path === './cypress/tsconfig.json')) {
        json.references.push({
          path: './cypress/tsconfig.json',
        });
      }
      return json;
    }
  );
}

export default normalizeCyTsConfigNames;
