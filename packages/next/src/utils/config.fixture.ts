module.exports = (phase, config, context) => {
  return {
    ...config,
    myPhase: phase,
    myCustomValue: context.options.customValue,
  };
};
