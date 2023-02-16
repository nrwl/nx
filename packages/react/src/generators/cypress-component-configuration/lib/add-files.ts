import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  ensurePackage,
  generateFiles,
  joinPathFragments,
  logger,
  parseTargetString,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { nxVersion } from 'nx/src/utils/versions';
import { getComponentNode } from '../../../utils/ast-utils';
import { componentTestGenerator } from '../../component-test/component-test';
import { CypressComponentConfigurationSchema } from '../schema';
import { FoundTarget } from './update-configs';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

const allowedFileExt = new RegExp(/\.[jt]sx?/g);
const isSpecFile = new RegExp(/(spec|test)\./g);

export async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigurationSchema,
  found: FoundTarget
) {
  const cypressConfigPath = joinPathFragments(
    projectConfig.root,
    'cypress.config.ts'
  );
  if (tree.exists(cypressConfigPath)) {
    tree.delete(cypressConfigPath);
  }

  const actualBundler = await getBundler(found, tree);

  if (options.bundler && options.bundler !== actualBundler) {
    logger.warn(
      `You have specified ${options.bundler} as the bundler but this project is configured to use ${actualBundler}.
      This may cause errors. If you are seeing errors, try removing the --bundler option.`
    );
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    projectConfig.root,
    {
      tpl: '',
      bundler: options.bundler ?? actualBundler,
    }
  );

  if (
    options.bundler === 'webpack' ||
    (!options.bundler && actualBundler === 'webpack')
  ) {
    addDependenciesToPackageJson(tree, {}, { '@nrwl/webpack': nxVersion });
  }

  if (options.generateTests) {
    const filePaths = [];
    visitNotIgnoredFiles(tree, projectConfig.sourceRoot, (filePath) => {
      if (isComponent(tree, filePath)) {
        filePaths.push(filePath);
      }
    });

    for (const filePath of filePaths) {
      await componentTestGenerator(tree, {
        project: options.project,
        componentPath: filePath,
      });
    }
  }
}

async function getBundler(
  found: FoundTarget,
  tree: Tree
): Promise<'vite' | 'webpack'> {
  if (found.target && found.config?.executor) {
    return found.config.executor === '@nrwl/vite:build' ? 'vite' : 'webpack';
  }

  const { target, project } = parseTargetString(
    found.target,
    await createProjectGraphAsync()
  );
  const projectConfig = readProjectConfiguration(tree, project);
  return projectConfig?.targets?.[target]?.executor === '@nrwl/vite:build'
    ? 'vite'
    : 'webpack';
}

function isComponent(tree: Tree, filePath: string): boolean {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (isSpecFile.test(filePath) || !allowedFileExt.test(filePath)) {
    return false;
  }

  const content = tree.read(filePath, 'utf-8');
  const sourceFile = tsModule.createSourceFile(
    filePath,
    content,
    tsModule.ScriptTarget.Latest,
    true
  );

  const cmpDeclaration = getComponentNode(sourceFile);
  return !!cmpDeclaration;
}
