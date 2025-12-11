export function createVersionConfig() {
  return {
    conventionalCommits: false,
    groupPreVersionCommand: '',
    preVersionCommand: '',
    deleteVersionPlans: undefined,
    manifestRootsToUpdate: undefined,
    specifierSource: undefined,
    currentVersionResolver: undefined,
    currentVersionResolverMetadata: undefined,
    preserveMatchingDependencyRanges: undefined,
    preserveLocalDependencyProtocols: undefined,
    fallbackCurrentVersionResolver: undefined,
    firstRelease: undefined,
    versionPrefix: undefined,
    updateDependents: undefined,
    logUnchangedProjects: undefined,
    versionActions: undefined,
    versionActionsOptions: undefined,
  };
}
