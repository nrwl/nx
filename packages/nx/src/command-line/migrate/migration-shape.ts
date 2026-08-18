// `factory` is the legacy Angular schematics field; it counts as a
// deterministic half exactly like `implementation`.
//
// The predicates stay structurally typed so this module never imports
// migrate.ts's types: migrate.ts imports this module, so an import back
// would close a cycle, and no lint rule guards this boundary.
interface MigrationShape {
  prompt?: string;
  implementation?: string;
  factory?: string;
}

/** A migration entry as written into the plan (migrations.json). */
export interface PlannedMigration extends MigrationShape {
  package: string;
  name: string;
  version: string;
  description?: string;
  documentation?: string;
}

function hasDeterministicImplementation(m: MigrationShape): boolean {
  return !!(m.implementation || m.factory);
}

export function isPromptOnlyMigration(m: MigrationShape): boolean {
  return !!m.prompt && !hasDeterministicImplementation(m);
}

export function isHybridMigration(m: MigrationShape): boolean {
  return !!m.prompt && hasDeterministicImplementation(m);
}
