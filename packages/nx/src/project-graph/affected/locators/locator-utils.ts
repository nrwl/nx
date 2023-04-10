import { LocatorResult } from '../affected-project-graph-models';

export function addReasonForProject(
  project: string,
  reason: string,
  occurence: string | null,
  touched: LocatorResult
) {
  const existingProjectEntry = touched.get(project);
  if (existingProjectEntry) {
    if (occurence) {
      const existingReasonEntry = existingProjectEntry.find(
        (r) => typeof r === 'object' && r !== null && r.reason === reason
      );
      if (existingReasonEntry && typeof existingReasonEntry === 'object') {
        existingReasonEntry.occurences.push(occurence);
      } else {
        existingProjectEntry.push({ reason, occurences: [occurence] });
      }
    } else {
      existingProjectEntry.push(reason);
    }
  } else {
    if (occurence) {
      touched.set(project, [{ reason, occurences: [occurence] }]);
    } else {
      touched.set(project, [reason]);
    }
  }
}
