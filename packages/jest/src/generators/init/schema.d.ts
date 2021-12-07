import { JestProjectSchema } from '@nrwl/jest/src/generators/jest-project/schema';

export type JestInitSchema = Pick<JestProjectSchema, 'transformer'>;
