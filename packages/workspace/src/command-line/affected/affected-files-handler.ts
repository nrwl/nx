import { AffectedMetadata } from './affected-metadata';
import { Dependencies, NxJson, ProjectNode } from '../shared-models';

export type MutableAffectedSharedState = AffectedMetadata & {
  markTouched: (p: string) => void;
  markAffected: (p: string) => void;
};

export interface AffectedContext {
  readonly readFileAtRevision: (s: string, r: string) => string;
  readonly readJsonAtRevision: (s: string, r: string) => any;
  readonly workspaceJson: any;
  readonly nxJson: NxJson;
  readonly dependencies: Dependencies;
  readonly projectNodes: ProjectNode[];
  readonly revisionRange: {
    readonly base: string;
    readonly head: string;
  };
  readonly withDeps: boolean;
}

export interface AffectedFilesHandler {
  contextReady(ctx: AffectedContext): void;
  filesTouched(files: string[]): void;
}
