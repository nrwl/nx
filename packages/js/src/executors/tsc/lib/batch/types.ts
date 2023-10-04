import type { ExecutorContext, ProjectGraphProjectNode } from '@nx/devkit';
import type { CopyAssetsHandler } from '../../../../utils/assets/copy-assets-handler';
import type { DependentBuildableProjectNode } from '../../../../utils/buildable-libs-utils';
import type { NormalizedExecutorOptions } from '../../../../utils/schema';
import type { TypescriptInMemoryTsConfig } from '../typescript-compilation';

export interface TaskInfo {
  task: string;
  options: NormalizedExecutorOptions;
  context: ExecutorContext;
  assetsHandler: CopyAssetsHandler;
  buildableProjectNodeDependencies: DependentBuildableProjectNode[];
  projectGraphNode: ProjectGraphProjectNode;
  tsConfig: TypescriptInMemoryTsConfig;
  startTime?: number;
  endTime?: number;
  terminalOutput: string;
}
