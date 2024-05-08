import type { Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
export function addExcludeSpecPattern(
  tree: Tree,
  configFilePath: string,
  excludeSpecPattern: string | string[]
) {
  let configFileContents = tree.read(configFilePath, 'utf-8');

  let ast = tsquery.ast(configFileContents);

  const E2E_CONFIG_SELECTOR =
    'PropertyAssignment:has(Identifier[name=e2e]) > ObjectLiteralExpression';
  const e2eConfigNodes = tsquery(ast, E2E_CONFIG_SELECTOR, {
    visitAllChildren: true,
  });
  if (e2eConfigNodes.length !== 0) {
    const e2eConfigNode = e2eConfigNodes[0];
    const EXCLUDE_SPEC_PATTERN_SELECTOR =
      'PropertyAssignment:has(Identifier[name="excludeSpecPattern"])';
    const excludeSpecPatternNodes = tsquery(
      e2eConfigNode,
      EXCLUDE_SPEC_PATTERN_SELECTOR,
      { visitAllChildren: true }
    );

    if (excludeSpecPatternNodes.length !== 0) {
      const excludeSpecPatternNode = excludeSpecPatternNodes[0];

      let updatedExcludePattern = Array.isArray(excludeSpecPattern)
        ? excludeSpecPattern
        : [excludeSpecPattern];

      tree.write(
        configFilePath,
        `${configFileContents.slice(
          0,
          excludeSpecPatternNode.getStart()
        )}excludeSpecPattern: ${JSON.stringify(
          updatedExcludePattern
        )}${configFileContents.slice(excludeSpecPatternNode.getEnd())}`
      );
    } else {
      tree.write(
        configFilePath,
        `${configFileContents.slice(
          0,
          e2eConfigNode.getStart() + 1
        )}excludeSpecPattern: ${JSON.stringify(
          excludeSpecPattern
        )},${configFileContents.slice(e2eConfigNode.getStart() + 1)}`
      );
    }
  }
}
