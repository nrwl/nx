module.exports = require('babel-loader').custom(() => {
  return {
    customOptions({ isTest, isModern, emitDecoratorMetadata, ...loader }) {
      return {
        custom: { isTest, isModern, emitDecoratorMetadata },
        loader,
      };
    },
    config(
      cfg,
      { customOptions: { isTest, isModern, emitDecoratorMetadata } }
    ) {
      // Add hint to our babel preset so it can handle modern vs legacy bundles.
      cfg.options.caller.isModern = isModern;
      cfg.options.caller.isTest = isTest;
      cfg.options.caller.emitDecoratorMetadata = emitDecoratorMetadata;
      return cfg.options;
    },
  };
});
