import type { ExecutorContext } from '@nx/devkit';
import {
  applyChangesToString,
  ChangeType,
  stripIndents,
  workspaceLayout,
  workspaceRoot,
} from '@nx/devkit';
import * as ts from 'typescript';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

import type { NextBuildBuilderOptions } from '../../../utils/types';
import { findNodes } from 'nx/src/utils/typescript';

export function createNextConfigFile(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const nextConfigPath = options.nextConfig
    ? join(context.root, options.nextConfig)
    : join(context.root, options.root, 'next.config.js');

  // Copy config file and our `.nx-helpers` folder to remove dependency on @nrwl/next for production build.
  if (existsSync(nextConfigPath)) {
    const helpersPath = join(options.outputPath, '.nx-helpers');
    mkdirSync(helpersPath, { recursive: true });
    copyFileSync(
      join(__dirname, '../../../utils/compose-plugins.js'),
      join(helpersPath, 'compose-plugins.js')
    );
    writeFileSync(join(helpersPath, 'with-nx.js'), getWithNxContent());
    writeFileSync(
      join(helpersPath, 'compiled.js'),
      `
        const withNx = require('./with-nx');
        module.exports = withNx;
        module.exports.withNx = withNx;
        module.exports.composePlugins = require('./compose-plugins').composePlugins;
      `
    );
    writeFileSync(
      join(options.outputPath, 'next.config.js'),
      readFileSync(nextConfigPath)
        .toString()
        .replace(/["']@nx\/next["']/, `'./.nx-helpers/compiled.js'`)
        // TODO(v17): Remove this once users have all migrated to new @nx scope and import from '@nx/next' not the deep import paths.
        .replace('@nx/next/plugins/with-nx', './.nx-helpers/compiled.js')
        .replace('@nrwl/next/plugins/with-nx', './.nx-helpers/compiled.js')
    );
  }
}
function readSource() {
  const withNxFile = join(__dirname, '../../../../plugins/with-nx.js');
  const withNxContent = readFileSync(withNxFile).toString();
  return {
    withNxFile,
    withNxContent,
  };
}

// Exported for testing
export function getWithNxContent({ withNxFile, withNxContent } = readSource()) {
  const withNxSource = ts.createSourceFile(
    withNxFile,
    withNxContent,
    ts.ScriptTarget.Latest,
    true
  );
  const getWithNxContextDeclaration = findNodes(
    withNxSource,
    ts.SyntaxKind.FunctionDeclaration
  )?.find(
    (node: ts.FunctionDeclaration) => node.name?.text === 'getWithNxContext'
  );
  if (getWithNxContextDeclaration) {
    withNxContent = applyChangesToString(withNxContent, [
      {
        type: ChangeType.Delete,
        start: getWithNxContextDeclaration.getStart(withNxSource),
        length: getWithNxContextDeclaration.getWidth(withNxSource),
      },
      {
        type: ChangeType.Insert,
        index: getWithNxContextDeclaration.getStart(withNxSource),
        text: stripIndents`function getWithNxContext() {
          return {
            workspaceRoot: '${workspaceRoot}',
            libsDir: '${workspaceLayout().libsDir}'
          }
        }`,
      },
    ]);
  }

  return withNxContent;
}
