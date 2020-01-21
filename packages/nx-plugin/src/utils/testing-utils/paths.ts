export function tmpProjPath(path?: string) {
  return path
    ? `${process.cwd()}/tmp/nx-e2e/proj/${path}`
    : `${process.cwd()}/tmp/nx-e2e/proj`;
}

export function tmpBackupProjPath(path?: string) {
  return path
    ? `${process.cwd()}/tmp/nx-e2e/proj-backup/${path}`
    : `${process.cwd()}/tmp/nx-e2e/proj-backup`;
}
