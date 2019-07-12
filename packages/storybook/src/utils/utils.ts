import {
  JsonParseMode,
  join,
  Path,
  JsonAstObject,
  parseJsonAst,
  JsonValue
} from '@angular-devkit/core';

import {
  SchematicsException,
  Tree,
  SchematicContext
} from '@angular-devkit/schematics';

import {
  findPropertyInAstObject,
  appendPropertyInAstObject,
  insertPropertyInAstObjectInOrder,
  appendValueInAstArray
} from '@schematics/angular/utility/json-utils';

import { get } from 'http';
import { SourceFile, createSourceFile, ScriptTarget } from 'typescript';

export interface NodePackage {
  name: string;
  version: string;
}

export const Constants = {
  addonDependencies: ['@storybook/addons'],
  tsConfigExclusions: ['stories', '**/*.stories.ts'],
  pkgJsonScripts: {
    storybook: 'start-storybook -p 9001 -c .storybook'
  },
  jsonIndentLevel: 2,
  coreAddonPrefix: '@storybook/addon-'
};

export function safeFileDelete(tree: Tree, path: string): boolean {
  if (tree.exists(path)) {
    tree.delete(path);
    return true;
  } else {
    return false;
  }
}

export function addPropertyToPackageJson(
  tree: Tree,
  context: SchematicContext,
  propertyName: string,
  propertyValue: { [key: string]: string }
) {
  addPropertyToJsonAst(
    tree,
    context,
    '/package.json',
    propertyName,
    propertyValue
  );
}

export function addPropertyToJsonAst(
  tree: Tree,
  context: SchematicContext,
  jsonPath: string,
  propertyName: string,
  propertyValue: { [key: string]: string } | JsonValue,
  appendInArray = false
) {
  const jsonAst = getJsonFile(tree, jsonPath);
  const jsonNode = findPropertyInAstObject(jsonAst, propertyName);
  const recorder = tree.beginUpdate(jsonPath);

  if (!jsonNode) {
    // outer node missing, add key/value
    appendPropertyInAstObject(
      recorder,
      jsonAst,
      propertyName,
      propertyValue,
      Constants.jsonIndentLevel
    );
  } else if (jsonNode.kind === 'object') {
    // property exists, update values
    for (const [key, value] of Object.entries(propertyValue as {
      [key: string]: string;
    })) {
      const innerNode = findPropertyInAstObject(jsonNode, key);

      if (!innerNode) {
        // 'propertyName' not found, add it
        context.logger.debug(`creating ${key} with ${value}`);

        insertPropertyInAstObjectInOrder(
          recorder,
          jsonNode,
          key,
          value,
          Constants.jsonIndentLevel
        );
      } else {
        // 'propertyName' found, overwrite value
        context.logger.debug(`overwriting ${key} with ${value}`);

        const { end, start } = innerNode;

        recorder.remove(start.offset, end.offset - start.offset);
        recorder.insertRight(start.offset, JSON.stringify(value));
      }
    }
  } else if (jsonNode.kind === 'array' && appendInArray) {
    appendValueInAstArray(recorder, jsonNode, propertyValue);
  }

  tree.commitUpdate(recorder);
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

  return new Promise(resolve => {
    return get(`http://registry.npmjs.org/${packageName}`, res => {
      let rawData = '';
      res.on('data', chunk => (rawData += chunk));
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

export function getTsSourceFile(host: Tree, path: string): SourceFile {
  const buffer = host.read(path);
  if (!buffer) {
    throw new SchematicsException(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = createSourceFile(path, content, ScriptTarget.Latest, true);

  return source;
}
