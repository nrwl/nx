export interface MavenExecutorSchema {
  phase?: string;
  goals?: string[] | string;
  args?: string[] | string;
  project?: string;
  __unparsed__?: string[];
}
