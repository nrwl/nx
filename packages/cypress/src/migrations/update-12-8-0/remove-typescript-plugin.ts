import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  getProjects,
  ProjectConfiguration,
  readJson,
  StringDeletion,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import {
  createSourceFile,
  isCallExpression,
  isExpressionStatement,
  isIdentifier,
  Node,
  ScriptTarget,
} from 'typescript';
import { dirname, join } from 'path';
import { installedCypressVersion } from '../../utils/cypress-version';

export default async function removeTypescriptPlugin(tree: Tree) {
  const cypressVersion = installedCypressVersion();
  if (cypressVersion < 7) {
    console.warn(
      `Cypress v${cypressVersion} is installed. This migration was skipped. Please rerun this migration after updating to Cypress 7.`
    );
    return;
  }

  for (const [_, proj] of getProjects(tree)) {
    const cypressTargets = getCypressTargets(proj);
    if (cypressTargets.length <= 0) {
      continue;
    }

    for (const target of cypressTargets) {
      const cypressConfigs = getCypressConfigs(target);

      for (const config of cypressConfigs) {
        const cypressConfig = readJson(tree, config);
        if (cypressConfig.pluginsFile) {
          let pluginPath = join(dirname(config), cypressConfig.pluginsFile);
          if (!tree.exists(pluginPath)) {
            pluginPath = ['.js', '.ts']
              .map((ext) => pluginPath + ext)
              .find((path) => tree.exists(path));
          }
          removePreprocessor(tree, pluginPath);
        }
      }
    }
  }

  await formatFiles(tree);
}

function removePreprocessor(tree: Tree, pluginPath: string) {
  const pluginContents = tree.read(pluginPath, 'utf-8');
  const sourceFile = createSourceFile(
    pluginPath,
    pluginContents,
    ScriptTarget.ESNext,
    true
  );

  const deletions: StringDeletion[] = [];

  const callback = (node: Node) => {
    // Look for the invocation of preprocessTypescript
    if (
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.getText(sourceFile) === 'preprocessTypescript' &&
      node.arguments.length < 2
    ) {
      // Get the Statement that the function call belongs to
      let n: Node = node.parent;
      while (!isExpressionStatement(n) && n === sourceFile) {
        n = n.parent;
      }

      deletions.push({
        type: ChangeType.Delete,
        start: n.getStart(),
        length:
          n.getWidth() +
          (pluginContents[n.getStart() + n.getWidth()] === ';' ? 1 : 0),
      });
    }
  };

  // Call the callback for every node in the file
  sourceFile.forEachChild(recurse);

  function recurse(node: Node) {
    callback(node);
    node.forEachChild((child) => recurse(child));
  }

  // Remove the preprocessor from the file
  tree.write(pluginPath, applyChangesToString(pluginContents, deletions));
}

function getCypressConfigs(target: TargetConfiguration): string[] {
  if (!target.configurations && !target.options.cypressConfig) {
    return [];
  } else if (!target.configurations && target.options.cypressConfig) {
    return [target.options.cypressConfig];
  }

  return [target.options, Object.values(target.configurations)]
    .filter((options) => !!options.cypressConfig)
    .map((options) => options.cypressConfig);
}

function getCypressTargets(proj: ProjectConfiguration) {
  if (!proj.targets) {
    return [];
  }
  return Object.values(proj.targets).filter(
    (target) => target.executor === '@nrwl/cypress:cypress'
  );
}
