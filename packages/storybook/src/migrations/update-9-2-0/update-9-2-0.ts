import { chain } from '@angular-devkit/schematics';
import { addCacheableOperation } from '../../schematics/init/init';

export default function() {
  return chain([addCacheableOperation]);
}
