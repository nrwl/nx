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
export declare function deriveGroupNameFromTarget(ciTargetName: string | undefined): string;
