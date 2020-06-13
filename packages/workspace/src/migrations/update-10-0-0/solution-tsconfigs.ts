import { basename, dirname, join, normalize, Path } from '@angular-devkit/core';
import {
  callRule,
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { formatFiles, readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
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
      if (_dir && ig.ignores(_dir)) {
        return;
      }
      const dirEntry = host.getDir(_dir);
      dirEntry.subfiles.forEach((file) => {
        if (ig.ignores(join(_dir, file))) {
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

export default function (schema: any): Rule {
  return chain([
    renameRootTsconfig,
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
          return updateJsonInTree(file, (j) => {
            j.extends = j.extends.replace(
              /tsconfig.json$/,
              'tsconfig.base.json'
            );
            return j;
          });
        } else if (basename(json.extends) === 'tsconfig.json') {
          const extendedTsconfig = readJsonInTree(host, extendedTsconfigPath);
          return chain([
            updateJsonInTree(file, (j) => {
              j.files =
                j.files ||
                extendedTsconfig.files?.map((p: string) =>
                  relative(file, join(extendedTsconfigPath, p))
                );
              j.include =
                j.include ||
                extendedTsconfig.include?.map((p: string) =>
                  relative(file, join(extendedTsconfigPath, p))
                );
              return j;
            }),
            updateJsonInTree(extendedTsconfigPath, (j) => {
              j.files = [];
              j.include = [];
              j.references = j.references || [];
              context.logger.info(
                `Referencing ${file} in ${extendedTsconfigPath}`
              );
              j.references.push({
                path: relative(dirname(extendedTsconfigPath), file),
              });
              return j;
            }),
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
