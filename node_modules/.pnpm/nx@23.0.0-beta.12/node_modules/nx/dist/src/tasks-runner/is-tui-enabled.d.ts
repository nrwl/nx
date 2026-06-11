import type { NxJsonConfiguration } from '../config/nx-json';
import { NxArgs } from '../utils/command-line-utils';
export declare const ORIGINAL_TUI_ENV_VALUE: string;
/**
 * @returns If tui is enabled
 */
export declare function isTuiEnabled(): boolean;
/**
 * Determines if the TUI should be enabled for the current environment.
 *
 * **Note:** This function should almost never be called directly. Instead, use the `isTuiEnabled` function.
 *
 * @param nxJson `nx.json`
 * @param nxArgs CLI Flags passed into Nx
 * @param skipCapabilityCheck Mainly used for unit tests.
 * @returns `true` if the TUI should be enabled, `false` otherwise.
 */
export declare function shouldUseTui(nxJson: NxJsonConfiguration, nxArgs: NxArgs, skipCapabilityCheck?: boolean): boolean;
