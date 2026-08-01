// nx-ignore-next-line
import type {
  MigrationsJsonMetadata as NxMigrationsJsonMetadata,
  SuccessfulMigration as NxSuccessfulMigration,
  FailedMigration,
  SkippedMigration,
  StoppedMigration,
} from 'nx/src/command-line/migrate/migrate-ui-api';

// Mirrors `packages/nx/src/command-line/migrate/migration-shape.ts`. graph/*
// keeps its runtime decoupled from `nx`: existing `nx-ignore-next-line` imports
// from `nx/src/...` are type-only (erased at build), and the bundle ships in
// hosts that target multiple nx versions (the embedded `nx migrate` UI plus
// Nx Console's snapshot). Importing these helpers from `nx` would either drag
// node-only modules into the browser bundle (via `migrate-ui-api`) or assume a
// symbol that older nx versions don't export (`migration-shape` itself only
// exists from 23.0.0-beta.20+). Mirroring keeps the shape check self-contained
// and degrades cleanly: on older metadata, `prompt` is undefined and both
// predicates return false, so prompt UI stays hidden. `factory` is the legacy
// Angular-schematics field, treated equivalently to `implementation`.
type MigrationShape = {
  prompt?: string;
  implementation?: string;
  factory?: string;
};

function hasDeterministicImplementation(m: MigrationShape): boolean {
  return !!(m.implementation || m.factory);
}

export function isPromptOnlyShape(m: MigrationShape): boolean {
  return !!m.prompt && !hasDeterministicImplementation(m);
}

export function isHybridShape(m: MigrationShape): boolean {
  return !!m.prompt && hasDeterministicImplementation(m);
}

// TODO(nxc-4477): drop these augmentations once the installed `nx` baseline in
// this workspace (currently 23.0.0-beta.18) includes `acknowledgedPrompt` on
// `SuccessfulMigration` and switch call sites back to importing these types
// directly from `nx/src/command-line/migrate/migrate-ui-api`. graph-migrate
// has no real `nx` dep (would close a graph cycle via
// nx → graph-client → graph-migrate), so its type imports resolve against the
// installed-nx baseline; the local augmentation surfaces the new field
// without forcing a workspace-level nx dep. On older runtime nx versions the
// field is undefined and the UI degrades to "no prompt acknowledged".
//
// `MigrationsJsonMetadata` is also mirrored so the augmented `SuccessfulMigration`
// flows through `completedMigrations` narrowing — call sites get the new field
// without per-site casts. Listing the union members locally is intentional: if
// upstream adds a new variant, the narrower local type will fail to accept
// inbound values at the consumer boundary, forcing us to handle it.
export type SuccessfulMigration = NxSuccessfulMigration & {
  acknowledgedPrompt?: boolean;
};

export type MigrationsJsonMetadata = Omit<
  NxMigrationsJsonMetadata,
  'completedMigrations'
> & {
  completedMigrations?: Record<
    string,
    SuccessfulMigration | FailedMigration | SkippedMigration | StoppedMigration
  >;
};
