export interface MigrationDefinition {
  packageName: string;
  version: string;
  angularVersion?: string;
  incompatibleWithAngularVersion?: boolean;
}
