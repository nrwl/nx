export interface Json {
  [k: string]: any;
}

export interface Schema extends Json {
  projectName: string;
  skipFormat: boolean;
  forceRemove: boolean;
}
