import { cleanupProject, newProject } from "@nx/e2e-utils";

export function setupIndependentDeployabilityTest() {
  let proj: string;
  process.env.NX_ADD_PLUGINS = "false";
  proj = newProject();
  return proj;
}

export function cleanupIndependentDeployabilityTest() {
  cleanupProject();
  delete process.env.NX_ADD_PLUGINS;
}
