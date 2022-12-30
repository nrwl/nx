import type { SourceFile, Node } from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

export function checkSharedNpmPackagesMatchExpected(ast: SourceFile) {
  const SHARE_HELPER_SELECTOR =
    'PropertyAssignment:has(Identifier[name=shared]) > CallExpression:has(Identifier[name=share])';
  const SHARED_PACKAGE_CONFIG_SELECTOR =
    'ObjectLiteralExpression > PropertyAssignment > ObjectLiteralExpression';

  const shareHelperNodes = tsquery(ast, SHARE_HELPER_SELECTOR, {
    visitAllChildren: true,
  });

  let sharedPackageConfigNodes: Node[];
  let settingsToMatch: string[] = [];
  if (shareHelperNodes.length === 0) {
    // if we arent sharing using share helper, check for standard object sharing syntax
    const SHARED_OBJECT_SELECTOR =
      'PropertyAssignment:has(Identifier[name=shared]) > ObjectLiteralExpression';
    const sharedObjectNodes = tsquery(ast, SHARED_OBJECT_SELECTOR, {
      visitAllChildren: true,
    });

    if (sharedObjectNodes.length === 0) {
      // nothing is being shared, we're safe to continue
      return true;
    }

    sharedPackageConfigNodes = tsquery(
      sharedObjectNodes[0],
      SHARED_PACKAGE_CONFIG_SELECTOR,
      { visitAllChildren: true }
    );

    settingsToMatch = [`singleton: true`, `strictVersion: true`];
  } else {
    sharedPackageConfigNodes = tsquery(
      shareHelperNodes[0],
      SHARED_PACKAGE_CONFIG_SELECTOR,
      { visitAllChildren: true }
    );

    settingsToMatch = [
      `singleton: true`,
      `strictVersion: true`,
      `requiredVersion: 'auto'`,
    ];
  }

  if (sharedPackageConfigNodes.length === 0) {
    // we arent sharing configs with the share helper, so we can safely continue
    return true;
  }

  let packagesMatch = true;
  for (const configNode of sharedPackageConfigNodes) {
    const configText = configNode.getText();
    packagesMatch = settingsToMatch.every((setting) =>
      configText.includes(setting)
    );

    if (!packagesMatch) {
      break;
    }
  }

  return packagesMatch;
}
