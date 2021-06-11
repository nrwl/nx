import { Rule } from '@angular-devkit/schematics';
import { existsSync } from 'fs';
import { moveSync } from 'fs-extra';

export default function update(): Rule {
  return () => {
    if (existsSync('tools/schematics')) {
      moveSync('tools/schematics', 'tools/generators');
    }
  };
}
