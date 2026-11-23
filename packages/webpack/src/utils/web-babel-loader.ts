interface WebBabelCustomOptions {
  isTest?: boolean;
  isModern?: boolean;
  emitDecoratorMetadata?: boolean;
}

module.exports = require('babel-loader').custom(() => {
  return {
    customOptions({
      isTest,
      isModern,
      emitDecoratorMetadata,
      ...loader
    }: WebBabelCustomOptions & Record<string, unknown>) {
      return {
        custom: { isTest, isModern, emitDecoratorMetadata },
        loader,
      };
    },
    config(
      cfg: { options: { caller: Record<string, unknown> } },
      {
        customOptions: { isTest, isModern, emitDecoratorMetadata },
      }: { customOptions: WebBabelCustomOptions }
    ) {
      // Add hint to our babel preset so it can handle modern vs legacy bundles.
      cfg.options.caller.isModern = isModern;
      cfg.options.caller.isTest = isTest;
      cfg.options.caller.emitDecoratorMetadata = emitDecoratorMetadata;
      return cfg.options;
    },
  };
});
