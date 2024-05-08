import type { Tree } from '@nx/devkit';

import { tsquery } from '@phenomnomnominal/tsquery';

export function upsertBaseUrl(
  tree: Tree,
  configFilePath: string,
  baseUrlValueInProject: string
) {
  const configFileContents = tree.read(configFilePath, 'utf-8');

  const ast = tsquery.ast(configFileContents);
  const BASE_URL_SELECTOR =
    'PropertyAssignment:has(Identifier[name=e2e]) PropertyAssignment:has(Identifier[name="baseUrl"])';

  const baseUrlNodes = tsquery(ast, BASE_URL_SELECTOR, {
    visitAllChildren: true,
  });
  if (baseUrlNodes.length !== 0) {
    // The property exists in the config
    const baseUrlValueNode = baseUrlNodes[0].getChildAt(2);
    const baseUrlValue = baseUrlValueNode.getText().replace(/(["'])/, '');

    if (baseUrlValue === baseUrlValueInProject) {
      return;
    }

    tree.write(
      configFilePath,
      `${configFileContents.slice(
        0,
        baseUrlValueNode.getStart()
      )}"${baseUrlValueInProject}"${configFileContents.slice(
        baseUrlValueNode.getEnd()
      )}`
    );
  } else {
    const E2E_OBJECT_SELECTOR =
      'PropertyAssignment:has(Identifier[name=e2e]) ObjectLiteralExpression';

    const e2eConfigNodes = tsquery(ast, E2E_OBJECT_SELECTOR, {
      visitAllChildren: true,
    });
    if (e2eConfigNodes.length !== 0) {
      const e2eConfigNode = e2eConfigNodes[0];
      tree.write(
        configFilePath,
        `${configFileContents.slice(
          0,
          e2eConfigNode.getEnd() - 1
        )}baseUrl: "${baseUrlValueInProject}",
        ${configFileContents.slice(e2eConfigNode.getEnd() - 1)}`
      );
    }
  }
}
