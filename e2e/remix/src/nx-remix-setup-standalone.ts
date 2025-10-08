import { cleanupProject, killPorts, newProject } from "@nx/e2e-utils";

export function setupNxRemixTestStandalone() {
  const proj = newProject({ packages: ["@nx/remix"] });
  return proj;
}

export function cleanupNxRemixTest() {
  killPorts();
  cleanupProject();
}
