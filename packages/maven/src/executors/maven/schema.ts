export interface MavenExecutorSchema {
  phase?: string;
  goals?: string[] | string;
  args?: string[] | string;
  excludeDependsOn?: boolean;
  __unparsed__?: string[];
}
