// `factory` is the legacy Angular schematics field; treat it equivalently to
// `implementation` when deciding whether a migration has a deterministic half.
//
// Structurally typed so consumers in adjacent modules (migrate-output,
// inside-agent rendering) can call the predicates without importing the heavy
// `ExecutableMigration` type — a circular import we explicitly avoid.
interface MigrationShape {
  prompt?: string;
  implementation?: string;
  factory?: string;
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
