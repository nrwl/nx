import {
  Tree,
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  joinPathFragments,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  ImportDeclaration,
  VariableStatement,
  ScriptTarget,
  isVariableStatement,
} from 'typescript';

const JS_TS_FILE_MATCHER = /\.[jt]sx?$/;

const importMatch =
  ':matches(ImportDeclaration, VariableStatement):has(Identifier[name="CacheModule"], Identifier[name="CacheModule"]):has(StringLiteral[value="@nestjs/common"])';

export async function updateNestJs10(tree: Tree) {
  const nestProjects = await getNestProejcts();
  if (nestProjects.length === 0) {
    return;
  }

  let installCacheModuleDeps = false;
  const projects = getProjects(tree);

  for (const projectName of nestProjects) {
    const projectConfig = projects.get(projectName);
    const tsConfig =
      projectConfig.targets?.build?.options?.tsConfig ??
      joinPathFragments(
        projectConfig.root,
        projectConfig.projectType === 'application'
          ? 'tsconfig.app.json'
          : 'tsconfig.lib.json'
      );

    if (tree.exists(tsConfig)) {
      updateTsConfigTarget(tree, tsConfig);
    }

    visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
      if (!JS_TS_FILE_MATCHER.test(filePath)) {
        return;
      }

      installCacheModuleDeps =
        updateCacheManagerImport(tree, filePath) || installCacheModuleDeps;
    });
  }

  await formatFiles(tree);

  return installCacheModuleDeps
    ? addDependenciesToPackageJson(
        tree,
        {
          '@nestjs/cache-manager': '^2.0.0',
          'cache-manager': '^5.2.3',
        },
        {}
      )
    : () => {};
}

async function getNestProejcts(): Promise<string[]> {
  const projectGraph = await createProjectGraphAsync();

  return Object.entries(projectGraph.dependencies)
    .filter(([node, dep]) =>
      dep.some(
        ({ target }) =>
          !projectGraph.externalNodes?.[node] && target === 'npm:@nestjs/common'
      )
    )
    .map(([projectName]) => projectName);
}

// change import { CacheModule } from '@nestjs/common';
// to import { CacheModule } from '@nestjs/cache-manager';
export function updateCacheManagerImport(
  tree: Tree,
  filePath: string
): boolean {
  const content = tree.read(filePath, 'utf-8');

  const updated = tsquery.replace(
    content,
    importMatch,

    (node: ImportDeclaration | VariableStatement) => {
      const text = node.getText();
      return `${text.replace('CacheModule', '')}\n${
        isVariableStatement(node)
          ? "const { CacheModule } = require('@nestjs/cache-manager')"
          : "import { CacheModule } from '@nestjs/cache-manager';"
      }`;
    }
  );

  if (updated !== content) {
    tree.write(filePath, updated);
    return true;
  }
}

export function updateTsConfigTarget(tree: Tree, tsConfigPath: string) {
  updateJson(tree, tsConfigPath, (json) => {
    if (!json.compilerOptions.target) {
      return json;
    }

    const normalizedTargetName = json.compilerOptions.target.toUpperCase();
    // es6 isn't apart of the ScriptTarget enum but is a valid tsconfig target in json file
    const existingTarget =
      normalizedTargetName === 'ES6'
        ? ScriptTarget.ES2015
        : (ScriptTarget[normalizedTargetName] as unknown as ScriptTarget);

    if (existingTarget < ScriptTarget.ES2021) {
      json.compilerOptions.target = 'es2021';
    }

    return json;
  });
}

export default updateNestJs10;
