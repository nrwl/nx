export interface Schema {
  name: string;
  sourceDir?: string;
  nomodule: boolean;

  spec?: boolean;
  flat?: boolean;
  commonModule?: boolean;

  routing?: boolean;
  lazy?: boolean;
  parentModule?: string;
}
