import { Linter } from '@nrwl/linter';

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
}
