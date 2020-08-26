export interface Schema {
  name: string;
  directory: string;
  fileName: string;
  project: string;
  style: string;
  withTests?: boolean;
  js?: boolean;
}
