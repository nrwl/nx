import { readJsonInTree, writeJsonInTree } from '@nrwl/workspace';

export default function () {
  return (host: any) => {
    const p = readJsonInTree(host, 'package.json');
    if (p['ng-update']) {
      p['nx-migrations'] = p['ng-update'];
      delete p['ng-update'];
    }
    writeJsonInTree(host, 'package.json', p);
  };
}
