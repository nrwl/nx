import { basename, dirname, join, normalize, Path } from '@angular-devkit/core';
import {
  callRule,
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  NxJson,
  readJsonInTree,
  updateJsonInTree,
} from '@nrwl/workspace';
import ignore from 'ignore';
import { relative } from 'path';

function renameRootTsconfig(host: Tree) {
  if (!host.exists('tsconfig.json')) {
    throw new Error('Root tsconfig.json does not exist');
  }

  host.rename('tsconfig.json', 'tsconfig.base.json');
}

function visitNotIgnoredFiles(
  visitor: (file: Path, host: Tree, context: SchematicContext) => void | Rule,
  dir: Path = normalize('')
): Rule {
  return (host, context) => {
    let ig;
    if (host.exists('.gitignore')) {
      ig = ignore();
      ig.add(host.read('.gitignore').toString());
    }
    function visit(_dir: Path) {
      if (_dir && ig?.ignores(_dir)) {
        return;
      }
      const dirEntry = host.getDir(_dir);
      dirEntry.subfiles.forEach((file) => {
        if (ig?.ignores(join(_dir, file))) {
          return;
        }
        const maybeRule = visitor(join(_dir, file), host, context);
        if (maybeRule) {
          callRule(maybeRule, host, context).subscribe();
        }
      });

      dirEntry.subdirs.forEach((subdir) => {
        visit(join(_dir, subdir));
      });
    }

    visit(dir);
  };
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
    const relativePath =
      (relative(dirname(extendedTsconfigPath), file).startsWith('../')
        ? ''
        : './') + relative(dirname(extendedTsconfigPath), file);
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

const changeImplicitDependency = updateJsonInTree<NxJson>('nx.json', (json) => {
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
});

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
          let extendedTsconfig = originalExtendedTsconfigMap.get(
            extendedTsconfigPath
          );

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
