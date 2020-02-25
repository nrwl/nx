function getRollupOptions(options: any) {
  const globals = options.output.globals || {};
  globals.react = 'React';
  globals['react-dom'] = 'ReactDOM';
  globals['styled-components'] = 'styled';
  globals['@emotion/core'] = 'emotionCore';
  globals['@emotion/styled'] = 'emotionStyled';
  options.output.globals = globals;
  return options;
}

module.exports = getRollupOptions;
