export interface Schema {
  name: string;
  skipFormat: boolean;
  directory?: string;
  sourceDir?: string;
  nomodule: boolean;

  spec?: boolean;
  flat?: boolean;
  commonModule?: boolean;

  routing?: boolean;
  lazy?: boolean;
  parentModule?: string;
}
