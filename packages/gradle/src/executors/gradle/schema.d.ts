export interface gradleExecutorSchema {
  taskName: string;
  testClassName?: string;
  args?: string[] | string;
}
