export interface GradleExecutorSchema {
  taskName: string;
  testClassName?: string;
  args?: string[] | string;
  excludeDependsOn: boolean;
}
