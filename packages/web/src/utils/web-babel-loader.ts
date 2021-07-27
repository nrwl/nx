module.exports = require('babel-loader').custom(() => {
  return {
    customOptions({ isModern, emitDecoratorMetadata, ...loader }) {
      return {
        custom: { isModern, emitDecoratorMetadata },
        loader,
      };
    },
    config(cfg, { customOptions: { isModern, emitDecoratorMetadata } }) {
      // Add hint to our babel preset so it can handle modern vs legacy bundles.
      cfg.options.caller.isModern = isModern;
      cfg.options.caller.emitDecoratorMetadata = emitDecoratorMetadata;
      return cfg.options;
    },
  };
});
