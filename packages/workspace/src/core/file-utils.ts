export type { FileData } from '@nx/devkit';
export {
  Change,
  DeletedFileChange,
  FileChange,
  LockFileChange,
  TEN_MEGABYTES,
  WholeFileChange,
  calculateFileChanges,
  defaultFileRead,
  isDeletedFileChange,
  isLockFileChange,
  isWholeFileChange,
  readPackageJson,
} from '@nx/devkit/internal';
