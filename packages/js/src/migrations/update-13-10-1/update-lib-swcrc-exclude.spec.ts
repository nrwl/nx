import {
  addProjectConfiguration,
  ProjectConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateSwcRcExclude from './update-lib-swcrc-exclude';

const projectConfig: ProjectConfiguration = {
  root: 'libs/swc-lib',
  sourceRoot: 'libs/swc-lib/src',
  targets: {
    build: {
      executor: '@nrwl/js:swc',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'dist/libs/swc-lib',
        main: 'libs/swc-lib/src/index.ts',
        tsConfig: 'libs/swc-lib/tsconfig.lib.json',
        assets: ['libs/swc-lib/*.md'],
      },
    },
  },
};
const oldSwcRc = {
  jsc: {
    target: 'es2017',
    parser: {
      syntax: 'typescript',
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      decoratorMetadata: true,
      legacyDecorator: true,
    },
    keepClassNames: true,
    externalHelpers: true,
    loose: true,
  },
  module: {
    type: 'commonjs',
    strict: true,
    noInterop: true,
  },
  sourceMaps: true,
  exclude: [
    './src/**/.*.spec.ts$',
    './**/.*.spec.ts$',
    './src/**/jest-setup.ts$',
    './**/jest-setup.ts$',
    './**/.*.js$',
  ],
};
describe('Update .lib.swcrc exclude', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'swc-lib', projectConfig);

    tree.write('libs/swc-lib/.lib.swcrc', JSON.stringify(oldSwcRc));
  });

  it('should update the exclude pattern', () => {
    updateSwcRcExclude(tree);
    expect(tree.read('libs/swc-lib/.lib.swcrc', 'utf-8')).toMatchSnapshot();
  });

  it('should NOT update the exclude pattern if not present', () => {
    updateJson(tree, 'libs/swc-lib/.lib.swcrc', (json) => {
      delete json.exclude;
      return json;
    });

    const before = readJson(tree, 'libs/swc-lib/.lib.swcrc');
    updateSwcRcExclude(tree);
    const after = readJson(tree, 'libs/swc-lib/.lib.swcrc');

    expect(after.exclude).toBeFalsy();
    expect(after).toEqual(before);
  });

  it('should do nothing if .lib.swcrc doest not exist', () => {
    tree.delete('libs/swc-lib/.lib-swcrc');

    expect(() => updateSwcRcExclude(tree)).not.toThrowError();
  });
});
