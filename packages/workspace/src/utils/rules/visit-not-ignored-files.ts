import { join, normalize, Path } from '@angular-devkit/core';
import {
  callRule,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import ignore, { Ignore } from 'ignore';

export function visitNotIgnoredFiles(
  visitor: (file: Path, host: Tree, context: SchematicContext) => void | Rule,
  dir: Path = normalize('')
): Rule {
  return (host, context) => {
    let ig: Ignore | undefined;
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
