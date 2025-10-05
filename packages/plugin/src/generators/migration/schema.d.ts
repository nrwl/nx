export interface Schema {
  path: string;
  name?: string;
  description?: string;
  packageVersion: string;
  packageJsonUpdates?: boolean;
  skipFormat?: boolean;
}
