import * as path from 'path';
import { names } from '@nrwl/devkit';

const JS_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

module.exports = {
  process(src, filename, options): { code: string } {
    const assetFilename = JSON.stringify(path.basename(filename));

    if (filename.match(/\.svg$/)) {
      // Based on how SVGR generates a component name:
      // https://github.com/smooth-code/svgr/blob/01b194cf967347d43d4cbe6b434404731b87cf27/packages/core/src/state.js#L6
      const pascalCaseFilename = names(path.parse(filename).name).className;
      const componentName = `Svg${pascalCaseFilename}`;
      return {
        code: `const React = require('react');
      module.exports = {
        __esModule: true,
        default: ${assetFilename},
        ReactComponent: React.forwardRef(function ${componentName}(props, ref) {
          return {
            $$typeof: Symbol.for('react.element'),
            type: 'svg',
            ref: ref,
            key: null,
            props: Object.assign({}, props, {
              children: ${assetFilename}
            })
          };
        }),
      };`,
      };
    }

    if (JS_SOURCE_EXTENSIONS.includes(path.extname(filename))) {
      const transformer = getJsTransform();
      if (transformer) return transformer.process(src, filename, options);
    }

    // Fallback for unknown extensions
    return {
      code: `module.exports = ${assetFilename};`,
    };
  },
};

function getJsTransform() {
  try {
    return require('babel-jest').default;
  } catch {
    // ignored
  }

  try {
    return require('@swc/jest').createTransformer();
  } catch {
    // ignored
  }
}
