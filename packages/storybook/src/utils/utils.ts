import {
  JsonParseMode,
  join,
  Path,
  JsonAstObject,
  parseJsonAst,
  JsonValue,
} from '@angular-devkit/core';

import {
  SchematicsException,
  Tree,
  SchematicContext,
  Source,
  Rule,
  mergeWith,
  apply,
  forEach,
} from '@angular-devkit/schematics';

import { get } from 'http';
import {
  SourceFile,
  createSourceFile,
  ScriptTarget,
  CompilerOptions,
} from 'typescript';

export interface NodePackage {
  name: string;
  version: string;
}

export const Constants = {
  addonDependencies: ['@storybook/addons'],
  tsConfigExclusions: ['stories', '**/*.stories.ts'],
  pkgJsonScripts: {
    storybook: 'start-storybook -p 9001 -c .storybook',
  },
  jsonIndentLevel: 2,
  coreAddonPrefix: '@storybook/addon-',
  uiFrameworks: {
    angular: '@storybook/angular',
    react: '@storybook/react',
  } as const,
};
type Constants = typeof Constants;

type Framework = {
  type: keyof Constants['uiFrameworks'];
  uiFramework: Constants['uiFrameworks'][keyof Constants['uiFrameworks']];
};
export function isFramework(
  type: Framework['type'],
  schema: Pick<Framework, 'uiFramework'>
) {
  if (type === 'angular' && schema.uiFramework === '@storybook/angular') {
    return true;
  }
  if (type === 'react' && schema.uiFramework === '@storybook/react') {
    return true;
  }

  return false;
}

export function safeFileDelete(tree: Tree, path: string): boolean {
  if (tree.exists(path)) {
    tree.delete(path);
    return true;
  } else {
    return false;
  }
}

/**
 * Attempt to retrieve the latest package version from NPM
 * Return an optional "latest" version in case of error
 * @param packageName
 */
export function getLatestNodeVersion(
  packageName: string
): Promise<NodePackage> {
  const DEFAULT_VERSION = 'latest';

  return new Promise((resolve) => {
    return get(`http://registry.npmjs.org/${packageName}`, (res) => {
      let rawData = '';
      res.on('data', (chunk) => (rawData += chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(rawData);
          const version = (response && response['dist-tags']) || {};

          resolve(buildPackage(packageName, version.latest));
        } catch (e) {
          resolve(buildPackage(packageName));
        }
      });
    }).on('error', () => resolve(buildPackage(packageName)));
  });

  function buildPackage(
    name: string,
    version: string = DEFAULT_VERSION
  ): NodePackage {
    return { name, version };
  }
}

export function getJsonFile(tree: Tree, path: string): JsonAstObject {
  const buffer = tree.read(path);
  if (buffer === null) {
    throw new SchematicsException(`Could not read JSON file (${path}).`);
  }
  const content = buffer.toString();

  const packageJson = parseJsonAst(content, JsonParseMode.Strict);
  if (packageJson.kind !== 'object') {
    throw new SchematicsException('Invalid JSON file. Was expecting an object');
  }

  return packageJson;
}

export function parseJsonAtPath(tree: Tree, path: string): JsonAstObject {
  const buffer = tree.read(path);

  if (buffer === null) {
    throw new SchematicsException(`Could not read ${path}.`);
  }

  const content = buffer.toString();

  const json = parseJsonAst(content, JsonParseMode.Strict);
  if (json.kind !== 'object') {
    throw new SchematicsException(`Invalid ${path}. Was expecting an object`);
  }

  return json;
}

export type TsConfig = {
  extends: string;
  compilerOptions: CompilerOptions;
  include?: string[];
  exclude?: string[];
  references?: Array<{ path: string }>;
};

export function getTsConfigContent(tree: Tree, path: string) {
  const tsConfig = parseJsonAtPath(tree, path);
  const content = tsConfig.value as TsConfig;

  return content;
}

export function getTsSourceFile(host: Tree, path: string): SourceFile {
  const buffer = host.read(path);
  if (!buffer) {
    throw new SchematicsException(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = createSourceFile(path, content, ScriptTarget.Latest, true);

  return source;
}

export function applyWithOverwrite(source: Source, rules: Rule[]): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const rule = mergeWith(
      apply(source, [
        ...rules,
        forEach((fileEntry) => {
          if (tree.exists(fileEntry.path)) {
            tree.overwrite(fileEntry.path, fileEntry.content);
            return null;
          }
          return fileEntry;
        }),
      ])
    );

    return rule(tree, _context);
  };
}

export function applyWithSkipExisting(source: Source, rules: Rule[]): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const rule = mergeWith(
      apply(source, [
        ...rules,
        forEach((fileEntry) => {
          if (tree.exists(fileEntry.path)) {
            return null;
          }
          return fileEntry;
        }),
      ])
    );

    return rule(tree, _context);
  };
}
