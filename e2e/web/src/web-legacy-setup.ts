import { cleanupProject, newProject } from "@nx/e2e-utils";

export function setupWebLegacyTest() {
  newProject();
}

export function cleanupWebLegacyTest() {
  cleanupProject();
}
