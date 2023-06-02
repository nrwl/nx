import { FileData } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import { fileHasher } from '../hasher/impl';

export function allFileData(): Promise<FileData[]> {
  if (daemonClient.enabled()) {
    return daemonClient.getAllFileData();
  } else {
    fileHasher.ensureInitialized();
    return Promise.resolve(fileHasher.allFileData());
  }
}
