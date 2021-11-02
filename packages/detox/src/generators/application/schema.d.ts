import { Linter } from '@nrwl/linter';

export interface Schema {
  project: string;
  name: string;
  directory?: string;
  linter?: Linter;
  js?: boolean;
  skipFormat?: boolean;
  setParserOptionsProject?: boolean;
}
