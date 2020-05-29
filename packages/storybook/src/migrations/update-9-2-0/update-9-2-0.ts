import { chain } from '@angular-devkit/schematics';
import { addCacheableOperation } from '../../schematics/init/init';
import { formatFiles } from '@nrwl/workspace';

export default function () {
  return chain([addCacheableOperation, formatFiles()]);
}
