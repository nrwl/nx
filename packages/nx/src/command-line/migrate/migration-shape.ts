// `factory` is the legacy Angular schematics field; treat it equivalently to
// `implementation` when deciding whether a migration has a deterministic half.
//
// The predicates stay structurally typed so consumers in adjacent modules
// (migrate-output, inside-agent rendering) can call them with partial shapes
// and without importing migrate.ts, a circular import we explicitly avoid.
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
