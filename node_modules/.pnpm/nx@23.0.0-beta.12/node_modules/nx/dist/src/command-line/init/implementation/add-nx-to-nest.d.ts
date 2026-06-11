import { InitArgs } from '../init-v1';
import { PackageJson } from '../../../utils/package-json';
type Options = Pick<InitArgs, 'nxCloud' | 'interactive' | 'cacheable'>;
export declare function addNxToNest(options: Options, packageJson: PackageJson): Promise<void>;
export {};
