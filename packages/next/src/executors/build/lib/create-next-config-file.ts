import type { ExecutorContext } from '@nrwl/devkit';
import {
  applyChangesToString,
  ChangeType,
  workspaceLayout,
  workspaceRoot,
  stripIndents,
} from '@nrwl/devkit';
import * as ts from 'typescript';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { NextBuildBuilderOptions } from '../../../utils/types';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript';

export function createNextConfigFile(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const nextConfigPath = options.nextConfig
    ? join(context.root, options.nextConfig)
    : join(context.root, options.root, 'next.config.js');

  // Copy config file and our `with-nx.js` file to remove dependency on @nrwl/next for production build.
  if (existsSync(nextConfigPath)) {
    writeFileSync(join(options.outputPath, 'with-nx.js'), getWithNxContent());
    writeFileSync(
      join(options.outputPath, 'next.config.js'),
      readFileSync(nextConfigPath)
        .toString()
        .replace('@nrwl/next/plugins/with-nx', './with-nx.js')
    );
  }
}

function getWithNxContent() {
  const withNxFile = join(__dirname, '../../../../plugins/with-nx.js');
  let withNxContent = readFileSync(withNxFile).toString();
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
