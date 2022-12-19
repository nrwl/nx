import {
  ensurePackage,
  generateFiles,
  joinPathFragments,
  logger,
  parseTargetString,
  ProjectConfiguration,
  readCachedProjectGraph,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { nxVersion } from 'nx/src/utils/versions';
import * as ts from 'typescript';
import { getComponentNode } from '../../../utils/ast-utils';
import { componentTestGenerator } from '../../component-test/component-test';
import { CypressComponentConfigurationSchema } from '../schema';
import { FoundTarget } from './update-configs';

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

  const actualBundler = getBundler(found, tree);

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
    await ensurePackage(tree, '@nrwl/webpack', nxVersion);
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

function getBundler(found: FoundTarget, tree: Tree): 'vite' | 'webpack' {
  if (found.target && found.config?.executor) {
    return found.config.executor === '@nrwl/vite:build' ? 'vite' : 'webpack';
  }

  const { target, project } = parseTargetString(
    found.target,
    readCachedProjectGraph()
  );
  const projectConfig = readProjectConfiguration(tree, project);
  return projectConfig?.targets?.[target]?.executor === '@nrwl/vite:build'
    ? 'vite'
    : 'webpack';
}

function isComponent(tree: Tree, filePath: string): boolean {
  if (isSpecFile.test(filePath) || !allowedFileExt.test(filePath)) {
    return false;
  }

  const content = tree.read(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const cmpDeclaration = getComponentNode(sourceFile);
  return !!cmpDeclaration;
}
