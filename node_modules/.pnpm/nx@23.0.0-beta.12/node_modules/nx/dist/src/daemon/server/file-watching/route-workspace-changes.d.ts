import type { WatchEvent } from '../../../native';
/**
 * Categorise a batch of watcher events by type and route them into the
 * recomputation queue. Deletions are taken at face value; created and
 * updated paths are stat'd to skip directories (the project graph only
 * cares about files). A stat error means the file was unlinked between
 * the watcher firing and us looking — drop the event.
 */
export declare function routeWorkspaceChanges(events: WatchEvent[]): void;
