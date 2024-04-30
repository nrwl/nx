/**
 * This file contains the logic to convert pnpm lockfile to a standard format.
 * It will convert inline specifiers to the separate specifiers format and ensure importers are present.
 */

import type { Lockfile } from '@pnpm/lockfile-types';
import { existsSync, readFileSync } from 'fs';
import { workspaceRoot } from '../../../../utils/workspace-root';

export function usesParenthesisVersionSeparator(data: {
  lockfileVersion: number | string;
}) {
  if (+data.lockfileVersion.toString() >= 6) {
    true;
  } else {
    return false;
  }
}

export function usesLeadingDash(data: { lockfileVersion: number | string }) {
  if (+data.lockfileVersion.toString() >= 9) {
    false;
  } else {
    return true;
  }
}

export function loadPnpmHoistedDepsDefinition() {
  const fullPath = `${workspaceRoot}/node_modules/.modules.yaml`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    const { load } = require('@zkochan/js-yaml');
    return load(content)?.hoistedDependencies ?? {};
  } else {
    throw new Error(`Could not find ".modules.yaml" at "${fullPath}"`);
  }
}

/**
 * Parsing and mapping logic from pnpm lockfile `read` function
 */
export function parseAndNormalizePnpmLockfile(content: string): Lockfile {
  const { load } = require('@zkochan/js-yaml');
  const {
    convertToLockfileObject,
  } = require('@pnpm/lockfile-file/lib/lockfileFormatConverters.js');
  return convertToLockfileObject(load(content));
}

// https://github.com/pnpm/pnpm/blob/50e37072f42bcca6d393a74bed29f7f0e029805d/lockfile/lockfile-file/src/write.ts#L22
const LOCKFILE_YAML_FORMAT = {
  blankLines: true,
  lineWidth: -1, // This is setting line width to never wrap
  noCompatMode: true,
  noRefs: true,
  sortKeys: false,
};

/**
 * Mapping and writing logic from pnpm lockfile `write` function
 */
export function stringifyToPnpmYaml(lockfile: Lockfile): string {
  const {
    convertToLockfileFile,
  } = require('@pnpm/lockfile-file/lib/lockfileFormatConverters.js');
  const {
    sortLockfileKeys,
  } = require('@pnpm/lockfile-file/lib/sortLockfileKeys.js');
  const { dump } = require('@zkochan/js-yaml');

  const adaptedLockfile = convertToLockfileFile(lockfile);
  return dump(sortLockfileKeys(adaptedLockfile), LOCKFILE_YAML_FORMAT);
}
