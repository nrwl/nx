export interface GradleExecutorSchema {
  taskName: string;
  testClassName?: string;
  args?: string[] | string;
  excludeDependsOn: boolean;
  __unparsed__?: string[];
}
