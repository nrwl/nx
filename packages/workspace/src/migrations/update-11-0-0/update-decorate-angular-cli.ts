import { join } from 'path';
import { readFileSync } from 'fs';
import { Tree } from '@angular-devkit/schematics';

export default function update() {
  return (host: Tree) => {
    const decorateCli = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        'generators',
        'utils',
        'decorate-angular-cli.js__tmpl__'
      )
    ).toString();
    if (host.exists('/decorate-angular-cli.js')) {
      host.overwrite('/decorate-angular-cli.js', decorateCli);
    }
  };
}
