import { basename, dirname, join, normalize, Path } from '@angular-devkit/core';
import { chain, Rule, Tree } from '@angular-devkit/schematics';
import type { NxJsonConfiguration } from '@nrwl/devkit';
import { formatFiles, readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { relative } from 'path';
import { visitNotIgnoredFiles } from '../../utils/rules/visit-not-ignored-files';

function renameRootTsconfig(host: Tree) {
  if (!host.exists('tsconfig.json')) {
    throw new Error('Root tsconfig.json does not exist');
  }

  host.rename('tsconfig.json', 'tsconfig.base.json');
}

function moveIncludesToProjectTsconfig(
  file: Path,
  extendedTsconfigPath: Path,
  extendedTsconfig: any
) {
  return updateJsonInTree(file, (json) => {
    json.files =
      json.files ||
      extendedTsconfig.files?.map((p: string) =>
        relative(dirname(file), join(dirname(extendedTsconfigPath), p))
      );
    json.include =
      json.include ||
      extendedTsconfig.include?.map((p: string) =>
        relative(dirname(file), join(dirname(extendedTsconfigPath), p))
      );
    return json;
  });
}

function convertToSolutionTsconfig(tsconfigPath: Path): Rule {
  return updateJsonInTree(tsconfigPath, (json) => {
    json.files = [];
    json.include = [];
    return json;
  });
}

function addReference(
  extendedTsconfigPath: string & { __PRIVATE_DEVKIT_PATH: void },
  file: Path
): Rule {
  return updateJsonInTree(extendedTsconfigPath, (json, context) => {
    json.references = json.references || [];
    const relativePath = `${
      relative(dirname(extendedTsconfigPath), file).startsWith('../')
        ? ''
        : './'
    }${relative(dirname(extendedTsconfigPath), file)}`;
    context.logger.info(`Referencing ${file} in ${extendedTsconfigPath}`);
    json.references.push({
      path: relativePath,
    });
    return json;
  });
}

function updateExtend(file: Path): Rule {
  return updateJsonInTree(file, (json) => {
    json.extends = json.extends.replace(/tsconfig.json$/, 'tsconfig.base.json');
    return json;
  });
}

const originalExtendedTsconfigMap = new Map<string, any>();

const changeImplicitDependency = updateJsonInTree<NxJsonConfiguration>(
  'nx.json',
  (json) => {
    if (
      !json.implicitDependencies ||
      !json.implicitDependencies['tsconfig.json']
    ) {
      return json;
    }
    json.implicitDependencies['tsconfig.base.json'] =
      json.implicitDependencies['tsconfig.json'];
    delete json.implicitDependencies['tsconfig.json'];
    return json;
  }
);

export default function (schema: any): Rule {
  return chain([
    renameRootTsconfig,
    changeImplicitDependency,
    visitNotIgnoredFiles((file, host, context) => {
      if (!file.endsWith('.json')) {
        return;
      }

      try {
        const json = readJsonInTree(host, file);
        if (!json.extends) {
          return;
        }
        const extendedTsconfigPath = join(dirname(file), json.extends);
        if (extendedTsconfigPath === normalize('tsconfig.json')) {
          return updateExtend(file);
        } else if (basename(json.extends) === 'tsconfig.json') {
          let extendedTsconfig =
            originalExtendedTsconfigMap.get(extendedTsconfigPath);

          if (!extendedTsconfig) {
            extendedTsconfig = readJsonInTree(host, extendedTsconfigPath);
            originalExtendedTsconfigMap.set(
              extendedTsconfigPath,
              extendedTsconfig
            );
          }
          return chain([
            moveIncludesToProjectTsconfig(
              file,
              extendedTsconfigPath,
              extendedTsconfig
            ),
            convertToSolutionTsconfig(extendedTsconfigPath),
            addReference(extendedTsconfigPath, file),
          ]);
        } else {
          return;
        }
      } catch (e) {
        context.logger.warn(`Could not update ${file}: Invalid JSON`);
      }
    }),
    formatFiles(),
  ]);
}
