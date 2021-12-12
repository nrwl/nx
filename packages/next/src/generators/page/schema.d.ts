import { SupportedStyles } from '@nrwl/react';

export interface Schema {
  name: string;
  project: string;
  style: SupportedStyles;
  directory?: string;
  fileName?: string;
  withTests?: boolean;
  js?: boolean;
  flat?: boolean;
}
