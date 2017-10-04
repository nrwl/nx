export interface Schema {
  name: string;
  directory: string;
  npmScope?: string;
  version?: string;
  prefix?: string;
  style?: string;
  minimal?: boolean;
}
