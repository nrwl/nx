export function tmpProjPath(path?: string) {
  return path ? `./tmp/nx-e2e/proj/${path}` : `./tmp/nx-e2e/proj`;
}

export function tmpBackupProjPath(path?: string) {
  return path ? `./tmp/nx-e2e/proj-backup/${path}` : `./tmp/nx-e2e/proj-backup`;
}
