import { externalSchematic } from '@angular-devkit/schematics';

interface Schema {
  npmScope: string;
  name: string;
  skipInstall: boolean;
}

export default function(schema: Schema) {
  return externalSchematic('@nrwl/workspace', 'ng-add', schema);
}
