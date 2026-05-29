import type { SupportedBundler } from '../_utils/normalize';

export interface ProviderGeneratorSchema {
  directory: string;
  bundler?: SupportedBundler;
  port?: number;
  exposeName?: string;
  consumer?: string;
}
