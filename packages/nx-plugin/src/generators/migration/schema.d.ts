export interface Schema {
  project: string;
  name?: string;
  description?: string;
  packageVersion: string;
  packageJsonUpdates?: boolean;
}
