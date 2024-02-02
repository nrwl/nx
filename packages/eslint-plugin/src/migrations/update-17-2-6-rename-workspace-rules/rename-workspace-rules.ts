import { Tree, formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import { isBinaryPath } from '@nx/devkit/src/utils/binary-extensions';
import { WORKSPACE_PLUGIN_DIR, WORKSPACE_RULES_PATH } from '../../constants';

export default async function renameWorkspaceRule(tree: Tree): Promise<void> {
  if (!tree.exists(WORKSPACE_RULES_PATH)) {
    return;
  }
  let ruleNames: string[] = [];
  try {
    ruleNames = Object.keys(require(WORKSPACE_PLUGIN_DIR).rules);
  } catch (e) {
    return;
  }

  visitNotIgnoredFiles(tree, '.', (path) => {
    if (isBinaryPath(path)) {
      return;
    }

    let contents = tree.read(path, 'utf-8') as string;
    ruleNames.forEach((ruleName) => {
      contents = contents.replace(
        new RegExp(`@nx/workspace/${ruleName}`, 'g'),
        `@nx/workspace-${ruleName}`
      );
    });
    tree.write(path, contents);
  });

  await formatFiles(tree);
}
