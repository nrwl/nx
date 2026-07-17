import type { SupportedBundler } from '../_utils/normalize';

export interface ConsumerGeneratorSchema {
  directory: string;
  bundler?: SupportedBundler;
  port?: number;
  providerNames?: string[];
}
