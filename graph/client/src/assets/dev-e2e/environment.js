window.exclude = [];
window.watch = false;
window.environment = 'dev';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: true,
  showExperimentalFeatures: true,
  workspaces: [
    {
      id: 'e2e',
      label: 'e2e',
      projectGraphUrl: 'assets/project-graphs/e2e.json',
      taskGraphUrl: 'assets/task-graphs/e2e.json',
      taskInputsUrl: 'assets/task-inputs/e2e.json',
      sourceMapsUrl: 'assets/source-maps/e2e.json',
    },
    {
      id: 'affected',
      label: 'affected',
      projectGraphUrl: 'assets/project-graphs/affected.json',
      taskGraphUrl: 'assets/task-graphs/affected.json',
      taskInputsUrl: 'assets/task-inputs/affected.json',
      sourceMapsUrl: 'assets/source-maps/e2e-affected.json',
    },
  ],
  defaultWorkspaceId: 'e2e',
};
