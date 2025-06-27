export function DevKitLoader() {
  return {
    name: 'nx-devkit-loader',
    // @ts-expect-error renderMarkdown is real idk why TS is complaining
    // https://docs.astro.build/en/reference/content-loader-reference/#rendermarkdown
    async load({ store, logger, watcher, renderMarkdown }: LoaderContext) {
      logger.info('DevKitLoader is not implemented yet');
      return [];
    },
  };
}
