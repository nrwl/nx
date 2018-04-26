export interface Schema {
  name: string;
  directory?: string;
  sourceDir?: string;
  publishable: boolean;

  spec?: boolean;
  flat?: boolean;
  commonModule?: boolean;

  routing?: boolean;
  lazy?: boolean;
  parentModule?: string;
  tags?: string;
}
