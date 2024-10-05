import * as rollup from 'rollup';

// TODO(v22): Remove this in Nx 22 and migrate to explicit rollup.config.js files.
/**
 * @deprecated Use `withNx` function from `@nx/rollup/with-nx` in your rollup.config.js file instead. Use `nx g @nx/rollup:convert-to-inferred` to generate the rollup.config.js file if it does not exist.
 */
function getRollupOptions(options: rollup.RollupOptions) {
  const extraGlobals = {
    react: 'React',
    'react-dom': 'ReactDOM',
    'styled-components': 'styled',
    '@emotion/react': 'emotionReact',
    '@emotion/styled': 'emotionStyled',
  };

  if (Array.isArray(options.output)) {
    options.output.forEach((o) => {
      o.globals = { ...o.globals, ...extraGlobals };
    });
  } else {
    options.output = {
      ...options.output,
      globals: {
        ...options.output.globals,
        ...extraGlobals,
      },
    };
  }

  // React buildable libs support SVGR, but not for React Native.
  // If imports fail, ignore it.
  try {
    const url = require('@rollup/plugin-url');
    const svg = require('@svgr/rollup');

    options.plugins = [
      svg({
        svgo: false,
        titleProp: true,
        ref: true,
      }),
      url({
        limit: 10000, // 10kB
      }),
      ...(Array.isArray(options.plugins) ? options.plugins : []),
    ];
  } catch {
    // Ignored for React Native
  }

  return options;
}

module.exports = getRollupOptions;
