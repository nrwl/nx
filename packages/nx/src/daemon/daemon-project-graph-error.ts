import { ProjectGraph } from '../config/project-graph';
import { ConfigurationSourceMaps } from '../project-graph/utils/project-configuration-utils';

export class DaemonProjectGraphError extends Error {
  constructor(
    public errors: any[],
    readonly projectGraph: ProjectGraph,
    readonly sourceMaps: ConfigurationSourceMaps
  ) {
    super(
      `The Daemon Process threw an error while calculating the project graph. Convert this error to a ProjectGraphError to get more information.`
    );
    this.name = this.constructor.name;
  }
}
