export interface MavenExecutorSchema {
  phase?: string;
  goals?: string[] | string;
  args?: string[] | string;
  __unparsed__?: string[];
}
