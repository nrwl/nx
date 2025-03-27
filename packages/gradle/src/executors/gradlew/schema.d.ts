export interface GraldewExecutorSchema {
  taskName: string;
  testClassName?: string;
  args?: string[] | string;
}
