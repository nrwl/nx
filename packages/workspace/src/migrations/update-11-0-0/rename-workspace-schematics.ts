import { Rule } from '@angular-devkit/schematics';
import * as fs from 'fs-extra';

export default function update(): Rule {
  return () => {
    fs.moveSync('tools/schematics', 'tools/generators');
  };
}
