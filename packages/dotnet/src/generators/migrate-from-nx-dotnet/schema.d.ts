export interface MigrateFromNxDotnetSchema {
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  removeNxDotnetCore?: boolean;
  removeRcFile?: boolean;
  skipGitCheck?: boolean;
}
