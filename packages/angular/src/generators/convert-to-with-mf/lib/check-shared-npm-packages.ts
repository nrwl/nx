import type { SourceFile, Node } from 'typescript';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

export function checkSharedNpmPackagesMatchExpected(sourceFile: SourceFile) {
  ensureTypescript();
  const { query } = require('@phenomnomnominal/tsquery');
  const SHARE_HELPER_SELECTOR =
    'PropertyAssignment:has(Identifier[name=shared]) > CallExpression:has(Identifier[name=share])';
  const SHARED_PACKAGE_CONFIG_SELECTOR =
    'ObjectLiteralExpression > PropertyAssignment > ObjectLiteralExpression';

  const shareHelperNodes = query(sourceFile, SHARE_HELPER_SELECTOR);

  let sharedPackageConfigNodes: Node[];
  let settingsToMatch: string[] = [];
  if (shareHelperNodes.length === 0) {
    // if we arent sharing using share helper, check for standard object sharing syntax
    const SHARED_OBJECT_SELECTOR =
      'PropertyAssignment:has(Identifier[name=shared]) > ObjectLiteralExpression';
    const sharedObjectNodes = query(sourceFile, SHARED_OBJECT_SELECTOR);

    if (sharedObjectNodes.length === 0) {
      // nothing is being shared, we're safe to continue
      return true;
    }

    sharedPackageConfigNodes = query(
      sourceFile,
      `${SHARED_OBJECT_SELECTOR} ${SHARED_PACKAGE_CONFIG_SELECTOR}`
    );

    settingsToMatch = [`singleton: true`, `strictVersion: true`];
  } else {
    sharedPackageConfigNodes = query(
      sourceFile,
      `${SHARE_HELPER_SELECTOR} ${SHARED_PACKAGE_CONFIG_SELECTOR}`
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
