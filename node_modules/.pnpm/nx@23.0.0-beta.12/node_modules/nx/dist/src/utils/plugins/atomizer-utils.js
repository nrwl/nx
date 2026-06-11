"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveGroupNameFromTarget = deriveGroupNameFromTarget;
/**
 * Helper that tries to derive the name of the CI group, based on the related target name.
 *
 * This will work well when the CI target name follows the documented naming convention or similar (for e.g `test-ci`, `e2e-ci`, `ny-e2e-ci`, etc).
 *
 * For example, `test-ci` => `TEST (CI)`,  `e2e-ci` => `E2E (CI)`,  `my-e2e-ci` => `MY E2E (CI)`
 *
 * @param ciTargetName name of the CI target
 * @returns the derived group name or `${ciTargetName.toUpperCase()} (CI)` if cannot be derived automatically
 */
function deriveGroupNameFromTarget(ciTargetName) {
    if (!ciTargetName) {
        return null;
    }
    const parts = ciTargetName.split('-').map((v) => v.toUpperCase());
    if (parts.length > 1) {
        return `${parts.slice(0, -1).join(' ')} (${parts[parts.length - 1]})`;
    }
    return `${parts[0]} (CI)`; // default group name when there is a single segment
}
