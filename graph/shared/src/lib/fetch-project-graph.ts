import { Params } from 'react-router-dom';
import { AppConfig } from './app-config';
import { ProjectGraphService } from './project-graph-data-service/get-project-graph-data-service';

export async function fetchProjectGraph(
  projectGraphService: ProjectGraphService,
  params: Readonly<Params<string>>,
  appConfig: AppConfig
) {
  const selectedWorkspaceId =
    params.selectedWorkspaceId ?? appConfig.defaultWorkspaceId;

  const projectInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedWorkspaceId
  );

  return await projectGraphService.getProjectGraph(projectInfo.projectGraphUrl);
}
