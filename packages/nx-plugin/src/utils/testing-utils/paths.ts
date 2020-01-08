export function tmpProjPath(path?: string) {
  return path ? `./tmp-e2e/nx/proj/${path}` : `./tmp-e2e/nx/proj`;
}

export function tmpBackupProjPath(path?: string) {
  return path ? `./tmp-e2e/nx/proj-backup/${path}` : `./tmp-e2e/nx/proj-backup`;
}
