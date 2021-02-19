import { Rule } from '@angular-devkit/schematics';
import * as fs from 'fs-extra';

export default function update(): Rule {
  return () => {
    if (fs.existsSync('tools/schematics')) {
      fs.moveSync('tools/schematics', 'tools/generators');
    }
  };
}
