import { Linter } from '@nrwl/linter';

export interface Schema {
  project: string;
  name: string;
  directory?: string;
  linter: Linter; // default is eslint
  js: boolean; // default is false
  skipFormat: boolean; // default is false
  setParserOptionsProject: boolean; // default is false
  type: 'expo' | 'react-native'; // default is react-native
}
