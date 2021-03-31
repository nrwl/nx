import { Rule } from '@angular-devkit/schematics';
import { existsSync, moveSync } from 'fs-extra';

export default function update(): Rule {
  return () => {
    if (existsSync('tools/schematics')) {
      moveSync('tools/schematics', 'tools/generators');
    }
  };
}
