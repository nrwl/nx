import { join as pathJoin } from 'path';
import { readFileSync } from 'fs';
import { Tree } from '@nrwl/devkit';

export default function update(host: Tree) {
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
    host.write('/decorate-angular-cli.js', decorateCli);
  }
}
