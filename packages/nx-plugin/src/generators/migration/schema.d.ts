export interface Schema {
  project: string;
  name?: string;
  description?: string;
  version: string;
  packageJsonUpdates?: boolean;
}
