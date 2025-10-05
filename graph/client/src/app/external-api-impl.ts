import { ExternalApi, getExternalApiService } from '@nx/graph-shared';
import { getRouter } from './get-router';
import { GraphStateSerializer } from '@nx/graph';
import { ProjectElement } from '@nx/graph/projects';

export class ExternalApiImpl extends ExternalApi {
  router = getRouter();
  externalApiService = getExternalApiService();

  constructor() {
    super();
    this.externalApiService.subscribe(
      ({ type, payload }: { type: string; payload: any }) => {
        if (!this.graphInteractionEventListener) {
          console.log('graphInteractionEventListener not registered.');
          return;
        }
        this.graphInteractionEventListener({
          type,
          payload,
        });
      }
    );

    // make sure properties set before are taken into account again
    if (window.externalApi?.loadProjectGraph) {
      this.loadProjectGraph = window.externalApi.loadProjectGraph;
    }
    if (window.externalApi?.loadTaskGraph) {
      this.loadTaskGraph = window.externalApi.loadTaskGraph;
    }
    if (window.externalApi?.loadExpandedTaskInputs) {
      this.loadExpandedTaskInputs = window.externalApi.loadExpandedTaskInputs;
    }
    if (window.externalApi?.loadSourceMaps) {
      this.loadSourceMaps = window.externalApi.loadSourceMaps;
    }
    if (window.externalApi?.graphInteractionEventListener) {
      this.graphInteractionEventListener =
        window.externalApi.graphInteractionEventListener;
    }
  }

  async openProjectDetails(projectName: string, targetName?: string) {
    await this.router.navigate(
      `/project-details/${encodeURIComponent(projectName)}`
    );
    if (targetName) {
      this.focusTargetInProjectDetails(targetName);
    }
  }

  focusTargetInProjectDetails(targetName: string) {
    const currentLocation = this.router.state.location;

    const searchParams = new URLSearchParams(currentLocation.search);
    searchParams.set('expanded', targetName);

    const newUrl = `${currentLocation.pathname}?${searchParams.toString()}`;
    this.router.navigate(newUrl);
  }

  focusProject(projectName: string) {
    const serializedState = GraphStateSerializer.serialize({
      c: {},
      s: {
        type: 'focused',
        nodeId: ProjectElement.makeId('project', projectName),
      },
    });
    const searchParams = new URLSearchParams();
    searchParams.set('graph', serializedState);
    this.router.navigate(`/projects?${searchParams.toString()}`);
  }

  selectAllProjects() {
    const serializedState = GraphStateSerializer.serialize({
      c: { showMode: 'all' },
    });
    const searchParams = new URLSearchParams();
    searchParams.set('graph', serializedState);
    this.router.navigate(`/projects?${searchParams.toString()}`);
  }

  showAffectedProjects() {
    const serializedState = GraphStateSerializer.serialize({
      c: { showMode: 'affected' },
    });
    const searchParams = new URLSearchParams();
    searchParams.set('graph', serializedState);
    this.router.navigate(`/projects?${searchParams.toString()}`);
  }

  focusTarget(projectName: string, targetName: string) {
    this.router.navigate(
      `/tasks?targets=${encodeURIComponent(
        targetName
      )}&projects=${encodeURIComponent(projectName)}`
    );
  }

  selectAllTargetsByName(targetName: string) {
    this.router.navigate(
      `/tasks/all?targets=${encodeURIComponent(targetName)}`
    );
  }

  enableExperimentalFeatures() {
    localStorage.setItem('showExperimentalFeatures', 'true');
    window.appConfig.showExperimentalFeatures = true;
  }

  disableExperimentalFeatures() {
    localStorage.setItem('showExperimentalFeatures', 'false');
    window.appConfig.showExperimentalFeatures = false;
  }
}
