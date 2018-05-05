import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

export default {
  description: 'Add tools directory',
  run: () => {
    try {
      mkdirSync('tools');
    } catch (e) {}
    try {
      mkdirSync(path.join('tools', 'schematics'));
    } catch (e) {}
    writeFileSync(path.join('tools', 'schematics', '.gitkeep'), '');
  }
};
