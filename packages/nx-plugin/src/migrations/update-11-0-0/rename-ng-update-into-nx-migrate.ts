import { readJsonInTree } from '@nrwl/workspace';
import { serializeJson } from '@nrwl/devkit';

export default function () {
  return (host: any) => {
    const p = readJsonInTree(host, 'package.json');
    if (p['ng-update']) {
      p['nx-migrations'] = p['ng-update'];
      delete p['ng-update'];
    }
    host.overwrite('package.json', serializeJson(p));
  };
}
