import { Tree, readJson } from '@nrwl/devkit';

export default function update(host: Tree) {
  const p = readJson(host, 'package.json');
  if (p['ng-update']) {
    p['nx-migrations'] = p['ng-update'];
    delete p['ng-update'];
  }
  host.write('package.json', JSON.stringify(p, null, 2));
}
