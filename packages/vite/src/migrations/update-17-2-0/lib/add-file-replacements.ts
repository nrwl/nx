import { ChangeType, applyChangesToString } from '@nx/devkit';
import { FileReplacement } from '../../../../plugins/rollup-replace-files.plugin';
import { tsquery } from '@phenomnomnominal/tsquery';

export function addFileReplacements(
  configContents: string,
  fileReplacements: FileReplacement[]
): string {
  const pluginsObject = tsquery.query(
    configContents,
    `PropertyAssignment:has(Identifier[name="plugins"])`
  )?.[0];
  const replaceFilesPlugin = tsquery.query(
    configContents,
    `PropertyAssignment:has(Identifier[name="plugins"]) CallExpression:has(Identifier[name="replaceFiles"])`
  )?.[0];

  const firstImportDeclaration = tsquery.query(
    configContents,
    'ImportDeclaration'
  )?.[0];

  if (pluginsObject) {
    if (replaceFilesPlugin) {
      return configContents;
    } else {
      return applyChangesToString(configContents, [
        {
          type: ChangeType.Insert,
          index: pluginsObject.getStart() + `plugins: [`.length + 1,
          text: `replaceFiles(${JSON.stringify(fileReplacements)}),`,
        },
        firstImportDeclaration
          ? {
              type: ChangeType.Insert,
              index: firstImportDeclaration.getStart(),
              text: `import replaceFiles from '@nx/vite/plugins/rollup-replace-files.plugin';\n`,
            }
          : {
              type: ChangeType.Insert,
              index: 0,
              text: `import replaceFiles from '@nx/vite/plugins/rollup-replace-files.plugin';\n`,
            },
      ]);
    }
  } else {
    const foundDefineConfig = tsquery.query(
      configContents,
      'CallExpression:has(Identifier[name="defineConfig"])'
    )?.[0];

    if (!foundDefineConfig) {
      return;
    }
    return applyChangesToString(configContents, [
      {
        type: ChangeType.Insert,
        index: foundDefineConfig.getStart() + 14,
        text: `plugins: [replaceFiles(${JSON.stringify(fileReplacements)})],`,
      },
      firstImportDeclaration
        ? {
            type: ChangeType.Insert,
            index: firstImportDeclaration.getStart(),
            text: `import replaceFiles from '@nx/vite/plugins/rollup-replace-files.plugin';`,
          }
        : {
            type: ChangeType.Insert,
            index: 0,
            text: `import replaceFiles from '@nx/vite/plugins/rollup-replace-files.plugin';`,
          },
    ]);
  }
}
