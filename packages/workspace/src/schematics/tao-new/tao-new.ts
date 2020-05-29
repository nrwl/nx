import { Rule } from '@angular-devkit/schematics';
import { sharedNew, Schema } from '../shared-new/shared-new';

export default function (options: Schema): Rule {
  return sharedNew('nx', options);
}
