import { Linter } from '@nx/linter';

export interface Schema {
  project?: string;
  baseUrl?: string;
  name: string;
  directory?: string;
  linter?: Linter;
  js?: boolean;
  skipFormat?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
  skipPackageJson?: boolean;
  bundler?: 'webpack' | 'vite' | 'none';
}
