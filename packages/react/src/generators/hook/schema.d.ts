import { SupportedStyles } from '../../../typings/style';

export interface Schema {
  name: string;
  project: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  pascalCaseFiles?: boolean;
  pascalCaseDirs?: boolean;
  flat?: boolean;
  js?: boolean;
}
