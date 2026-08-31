/**
 * Why something was considered affected.
 *
 * One open shape rather than a discriminated union, because these cross the napi
 * boundary as `#[napi(object)]` structs and napi objects carry no tag. `kind`
 * is the discriminant; the rest are populated per kind and absent otherwise. A
 * locator that cannot attribute a single cause leaves the payload empty rather
 * than inventing one.
 *
 * Reasons are collected flat: an entity lists every reason that applies to it,
 * and propagation is expressed by naming the producer rather than nesting its
 * reasons. `nx affected --explain` prints every entity, so the producer's own
 * reasons are one lookup away in the same output.
 */
export type AffectedReasonKind =
  /** A changed file the project owns, by root. */
  | 'project-file'
  /** A `{workspaceRoot}` fileset a target declares as an input. */
  | 'implicit-dependency'
  /** `nx.json` changed, which can restructure the task graph. */
  | 'workspace-configuration'
  /** A project config no longer on disk, so its project is gone. */
  | 'deleted-project-configuration'
  /** A lockfile changed. */
  | 'lockfile'
  /** An external package's version moved. */
  | 'npm-package'
  /** The root tsconfig's path mappings changed. */
  | 'tsconfig'
  /** Project-level only: it depends on a project that was touched. */
  | 'dependency'
  /** Task-level: a changed file matched one of the task's inputs. */
  | 'input-file'
  /** Task-level: it reads the outputs of a task that is itself affected. */
  | 'dependent-output';

export interface AffectedReason {
  kind: AffectedReasonKind;
  /** The changed file responsible, when one file is. */
  file?: string;
  /** The fileset or glob that matched, when the signal came from a pattern. */
  pattern?: string;
  /** The external package whose version moved. */
  package?: string;
  /** The touched project this one depends on. */
  dependency?: string;
  /** The task whose outputs this task reads. */
  producer?: string;
}

/** A reason, bound to the project a locator marked. */
export interface TouchedProject extends AffectedReason {
  project: string;
}

/** One line of `--explain` output, without the leading bullet. */
export function formatAffectedReason(reason: AffectedReason): string {
  switch (reason.kind) {
    case 'project-file':
      return `owns changed file ${reason.file}`;
    case 'implicit-dependency':
      return `input {workspaceRoot}/${reason.pattern} matched ${reason.file}`;
    case 'workspace-configuration':
      return `${reason.file} changed, which can restructure the task graph`;
    case 'deleted-project-configuration':
      return `${reason.file} was deleted`;
    case 'lockfile':
      return `lockfile ${reason.file} changed`;
    case 'npm-package':
      return `depends on ${reason.package}, whose version changed`;
    case 'tsconfig':
      return `path mappings changed in ${reason.file}`;
    case 'dependency':
      return `depends on ${reason.dependency}, which is affected`;
    case 'input-file':
      return reason.pattern
        ? `input ${reason.pattern} matched ${reason.file}`
        : `input matched ${reason.file}`;
    case 'dependent-output':
      return `reads the outputs of ${reason.producer}, which is affected`;
  }
}
