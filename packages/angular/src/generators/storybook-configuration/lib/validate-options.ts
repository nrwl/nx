import type { StorybookConfigurationOptions } from '../schema';

export function validateOptions(options: StorybookConfigurationOptions): void {
  if (options.generateCypressSpecs && !options.generateStories) {
    throw new Error(
      'Cannot set generateCypressSpecs to true when generateStories is set to false.'
    );
  }
}
