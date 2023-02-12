import * as rollup from 'rollup';

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
      ...options.plugins,
    ];
  } catch {
    // Ignored for React Native
  }

  return options;
}

module.exports = getRollupOptions;
