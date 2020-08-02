import { SupportedStyles } from 'packages/react/typings/style';

export interface Schema {
  name: string;
  project: string;
  style?: SupportedStyles;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
  js?: boolean;
  flat?: boolean;
}
