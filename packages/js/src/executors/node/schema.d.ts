export const enum InspectType {
  Inspect = 'inspect',
  InspectBrk = 'inspect-brk',
}

export interface NodeExecutorOptions {
  inspect: boolean | InspectType;
  runtimeArgs: string[];
  args: string[];
  waitUntilTargets: string[];
  buildTarget: string;
  buildTargetOptions: Record<string, any>;
  host: string;
  port: number;
  watch: boolean;
}
