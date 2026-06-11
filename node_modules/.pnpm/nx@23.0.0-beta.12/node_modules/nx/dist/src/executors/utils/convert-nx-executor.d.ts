/**
 * This is a copy of the @nx/devkit utility but this should not be used outside of the nx package
 */
import { Executor } from '../../config/misc-interfaces';
/**
 * Convert an Nx Executor into an Angular Devkit Builder
 *
 * Use this to expose a compatible Angular Builder
 */
export declare function convertNxExecutor(executor: Executor): any;
