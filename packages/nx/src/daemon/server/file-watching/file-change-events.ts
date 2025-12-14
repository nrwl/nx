import { serverLogger } from '../logger';

export interface FileChangeEvent {
  createdFiles: string[];
  updatedFiles: string[];
  deletedFiles: string[];
}

const fileChangeListeners = new Set<(event: FileChangeEvent) => void>();

export function registerFileChangeListener(
  listener: (event: FileChangeEvent) => void
): void {
  fileChangeListeners.add(listener);
}

export function notifyFileChangeListeners(event: FileChangeEvent): void {
  for (const listener of fileChangeListeners) {
    try {
      listener(event);
    } catch (error) {
      serverLogger.log('Error notifying file change listener:', error);
    }
  }
}
