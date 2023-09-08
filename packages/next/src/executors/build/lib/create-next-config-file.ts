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
  ensureDirSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs-extra';
import { dirname, extname, join, relative } from 'path';
import { findNodes } from 'nx/src/utils/typescript';

import type { NextBuildBuilderOptions } from '../../../utils/types';

export function createNextConfigFile(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  // Don't overwrite the next.config.js file if output path is the same as the source path.
  if (
    options.outputPath.replace(/\/$/, '') ===
    context.projectGraph.nodes[context.projectName].data.root
  ) {
    return;
  }
  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;
  const configRelativeToProjectRoot = findNextConfigPath(
    projectRoot,
    // If user passed a config then it is relative to the workspace root, need to normalize it to be relative to the project root.
    options.nextConfig ? relative(projectRoot, options.nextConfig) : undefined
  );
  const configAbsolutePath = join(projectRoot, configRelativeToProjectRoot);

  if (!existsSync(configAbsolutePath)) {
    throw new Error('next.config.js not found');
  }

  // Copy config file and our `.nx-helpers` folder to remove dependency on @nrwl/next for production build.
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
    join(options.outputPath, configRelativeToProjectRoot),
    readFileSync(configAbsolutePath)
      .toString()
      .replace(/["']@nx\/next["']/, `'./.nx-helpers/compiled.js'`)
      // TODO(v17): Remove this once users have all migrated to new @nx scope and import from '@nx/next' not the deep import paths.
      .replace('@nx/next/plugins/with-nx', './.nx-helpers/compiled.js')
      .replace('@nrwl/next/plugins/with-nx', './.nx-helpers/compiled.js')
  );

  // Find all relative imports needed by next.config.js and copy them to the dist folder.
  const moduleFilesToCopy = getRelativeFilesToCopy(
    configRelativeToProjectRoot,
    projectRoot
  );
  for (const moduleFile of moduleFilesToCopy) {
    ensureDirSync(dirname(join(context.root, options.outputPath, moduleFile)));
    copyFileSync(
      join(context.root, projectRoot, moduleFile),
      join(context.root, options.outputPath, moduleFile)
    );
  }
}

function readSource(getFile: () => string): { file: string; content: string } {
  return {
    file: getFile(),
    content: readFileSync(getFile()).toString(),
  };
}

// Exported for testing
export function getWithNxContent(
  { file, content } = readSource(() =>
    join(__dirname, '../../../../plugins/with-nx.js')
  )
) {
  const withNxSource = ts.createSourceFile(
    file,
    content,
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
    content = applyChangesToString(content, [
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

  return content;
}

export function findNextConfigPath(
  dirname: string,
  userDefinedConfigPath?: string
): string {
  if (userDefinedConfigPath) {
    const file = userDefinedConfigPath;
    if (existsSync(file)) return file;
    throw new Error(
      `Cannot find the Next.js config file: ${userDefinedConfigPath}. Is the path correct in project.json?`
    );
  }

  const candidates = ['next.config.js', 'next.config.cjs', 'next.config.mjs'];
  for (const candidate of candidates) {
    if (existsSync(join(dirname, candidate))) return candidate;
  }
  throw new Error(
    `Cannot find any of the following files in your project: ${candidates.join(
      ', '
    )}. Is this a Next.js project?`
  );
}

// Exported for testing
export function getRelativeFilesToCopy(
  fileName: string,
  cwd: string
): string[] {
  const seen = new Set<string>();
  const collected = new Set<string>();

  function doCollect(currFile: string): void {
    // Prevent circular dependencies from causing infinite loop
    if (seen.has(currFile)) return;
    seen.add(currFile);

    const absoluteFilePath = join(cwd, currFile);
    const content = readFileSync(absoluteFilePath).toString();
    const files = getRelativeImports({ file: currFile, content });
    const modules = ensureFileExtensions(files, dirname(absoluteFilePath));

    const relativeDirPath = dirname(currFile);

    for (const moduleName of modules) {
      const relativeModulePath = join(relativeDirPath, moduleName);
      collected.add(relativeModulePath);
      doCollect(relativeModulePath);
    }
  }

  doCollect(fileName);

  return Array.from(collected);
}

// Exported for testing
export function getRelativeImports({
  file,
  content,
}: {
  file: string;
  content: string;
}): string[] {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const callExpressionsOrImportDeclarations = findNodes(source, [
    ts.SyntaxKind.CallExpression,
    ts.SyntaxKind.ImportDeclaration,
  ]) as (ts.CallExpression | ts.ImportDeclaration)[];
  const modulePaths: string[] = [];
  for (const node of callExpressionsOrImportDeclarations) {
    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
      modulePaths.push(stripOuterQuotes(node.moduleSpecifier.getText(source)));
    } else {
      if (node.expression.getText(source) === 'require') {
        modulePaths.push(stripOuterQuotes(node.arguments[0].getText(source)));
      }
    }
  }
  return modulePaths.filter((path) => path.startsWith('.'));
}

function stripOuterQuotes(str: string): string {
  return str.match(/^["'](.*)["']/)?.[1] ?? str;
}

// Exported for testing
export function ensureFileExtensions(
  files: string[],
  absoluteDir: string
): string[] {
  const extensions = ['.js', '.cjs', '.mjs', '.json'];
  return files.map((file) => {
    const providedExt = extname(file);
    if (providedExt && extensions.includes(providedExt)) return file;

    const ext = extensions.find((ext) =>
      existsSync(join(absoluteDir, file + ext))
    );
    if (ext) {
      return file + ext;
    } else {
      throw new Error(
        `Cannot find file "${file}" with any of the following extensions: ${extensions.join(
          ', '
        )}`
      );
    }
  });
}
