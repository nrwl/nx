import { InitGeneratorSchema } from '../init/schema';

export interface RspackProjectGeneratorSchema extends InitGeneratorSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  target?: 'node' | 'web';
  skipValidation?: boolean;
}
