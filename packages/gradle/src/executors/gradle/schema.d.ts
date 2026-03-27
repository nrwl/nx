export interface GradleExecutorSchema {
  taskName: string;
  testClassName?: string;
  args?: string[] | string;
  excludeDependsOn: boolean;
  includeDependsOnTasks?: Array<{
    target: string;
    projects: string | string[];
  }>;
  __unparsed__?: string[];
}
