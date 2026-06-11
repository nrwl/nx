import { InitArgs } from '../init-v1';
type Options = Pick<InitArgs, 'nxCloud' | 'interactive'>;
export declare function addNxToTurborepo(_options: Options): Promise<void>;
export {};
