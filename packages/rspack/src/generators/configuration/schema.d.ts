import { InitGeneratorSchema } from '../init/schema';

export interface ConfigurationSchema extends InitGeneratorSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  target?: 'node' | 'web';
  skipValidation?: boolean;
  newProject?: boolean;
  buildTarget?: string;
  serveTarget?: string;
}
