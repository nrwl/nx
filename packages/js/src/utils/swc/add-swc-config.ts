// TODO(chau): change back to 2015 when https://github.com/swc-project/swc/issues/1108 is solved
// target: 'es2015'
// TODO(chau): "exclude" is required here to exclude spec files as --ignore cli option is not working atm
// Open issue: https://github.com/swc-project/cli/issues/20
import { Tree } from '@nrwl/devkit';
import { join } from 'path';

const swcOptionsString = () => `{
  "jsc": {
    "target": "es2017",
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "transform": {
      "decoratorMetadata": true,
      "legacyDecorator": true
    },
    "keepClassNames": true,
    "externalHelpers": true,
    "loose": true
  },
  "module": {
    "type": "commonjs",
    "strict": true,
    "noInterop": true
  },
  "exclude": ["./src/**/.*.spec.ts$", "./**/.*.js$"]
}`;

export function addSwcConfig(tree: Tree, projectDir: string) {
  const swcrcPath = join(projectDir, '.swcrc');
  const isSwcConfigExist = tree.exists(swcrcPath);
  if (isSwcConfigExist) return;

  tree.write(swcrcPath, swcOptionsString());
}
