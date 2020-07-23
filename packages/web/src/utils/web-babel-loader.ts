module.exports = require('babel-loader').custom((babel) => {
  return {
    customOptions({ isModern, ...loader }) {
      return {
        custom: { isModern },
        loader,
      };
    },
    config(cfg, { customOptions: { isModern } }) {
      // Add hint to our babel preset so it can handle modern vs legacy bundles.
      cfg.options.caller.isModern = isModern;
      return cfg.options;
    },
  };
});
