import type { ProjectGraph } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

export type MigrationContext = {
  logger: AggregatedLog;
  projectGraph: ProjectGraph;
  workspaceRoot: string;
};

export type TransformerContext = MigrationContext & {
  projectName: string;
  projectRoot: string;
};
