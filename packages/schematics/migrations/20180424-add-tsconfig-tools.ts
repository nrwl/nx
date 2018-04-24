import { writeFileSync } from 'fs';
import * as path from 'path';

export default {
  description: 'Add tsconfig.tools.json',
  run: () => {
    writeFileSync(
      path.join('tools', 'tsconfig.tools.json'),
      JSON.stringify(
        {
          extends: '../tsconfig.json',
          compilerOptions: {
            outDir: '../dist/out-tsc/tools',
            rootDir: '.',
            module: 'commonjs',
            target: 'es5',
            types: ['jasmine', 'node']
          },
          include: ['**/*.ts']
        },
        null,
        2
      )
    );
  }
};
