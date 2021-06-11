export interface Schema {
  name: string;
  command: string;
  project: string;
  cwd?: string;
  outputs?: string;
  envFile?: string;
}
