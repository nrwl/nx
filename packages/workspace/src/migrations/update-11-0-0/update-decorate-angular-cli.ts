import { Rule, Tree } from '@angular-devkit/schematics';
import { join as pathJoin } from 'path';
import { readFileSync } from 'fs';

export default function update(): Rule {
  return (host: Tree) => {
    const decorateCli = readFileSync(
      pathJoin(
        __dirname as any,
        '..',
        '..',
        'schematics',
        'utils',
        'decorate-angular-cli.js__tmpl__'
      )
    ).toString();
    if (host.exists('/decorate-angular-cli.js')) {
      host.overwrite('/decorate-angular-cli.js', decorateCli);
    }
  };
}
