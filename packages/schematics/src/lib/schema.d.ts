export interface Schema {
  name: string;
  sourceDir?: string;
  ngmodule: boolean;

  routing?: boolean;
  spec?: boolean;
  flat?: boolean;
  commonModule?: boolean;
}
