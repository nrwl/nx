import { ProjectGraphBuilder as DevkitProjectGraphBuilder } from '@nrwl/devkit';

export class ProjectGraphBuilder extends DevkitProjectGraphBuilder {
  build() {
    return super.getProjectGraph();
  }
}
