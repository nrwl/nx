import * as rollup from 'rollup';

function getRollupOptions(options: rollup.RollupOptions) {
  const extraGlobals = {
    react: 'React',
    'react-dom': 'ReactDOM',
    'styled-components': 'styled',
    '@emotion/core': 'emotionCore',
    '@emotion/styled': 'emotionStyled',
  };
  if (Array.isArray(options.output)) {
    options.output.forEach((o) => {
      o.globals = { ...o.globals, ...extraGlobals };
    });
  } else {
    options.output = {
      ...options.output,
      ...extraGlobals,
    };
  }
  return options;
}

module.exports = getRollupOptions;
