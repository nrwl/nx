/**
 * This file contains the logic to convert pnpm lockfile to a standard format.
 * It will convert inline specifiers to the separate specifiers format and ensure importers are present.
 */
import type { Lockfile } from '@pnpm/lockfile-types';
export declare function isV5Syntax(data: {
    lockfileVersion: number | string;
}): boolean;
export declare function usesLeadingDash(data: {
    lockfileVersion: number | string;
}): boolean;
export declare function loadPnpmHoistedDepsDefinition(): any;
/**
 * Parsing and mapping logic from pnpm lockfile `read` function
 */
export declare function parseAndNormalizePnpmLockfile(content: string): Lockfile;
/**
 * Mapping and writing logic from pnpm lockfile `write` function
 */
export declare function stringifyToPnpmYaml(lockfile: Lockfile): string;
