function getRollupOptions(options: any) {
  const globals = options.output.globals || {};
  globals.react = 'React';
  globals['react-dom'] = 'ReactDOM';
  options.output.globals = globals;
  return options;
}

module.exports = getRollupOptions;
