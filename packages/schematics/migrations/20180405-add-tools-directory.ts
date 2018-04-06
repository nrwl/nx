import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

export default {
  description: 'Add tools directory',
  run: () => {
    mkdirSync('tools');
    mkdirSync(path.join('tools', 'schematics'));
    writeFileSync(path.join('tools', 'schematics', '.gitkeep'), '');
  }
};
