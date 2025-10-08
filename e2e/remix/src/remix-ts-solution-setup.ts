import { cleanupProject, newProject } from "@nx/e2e-utils";

export function setupRemixTsSolutionTest() {
  newProject({
    packages: ["@nx/remix"],
    preset: "ts",
  });
}

export function cleanupRemixTsSolutionTest() {
  cleanupProject();
}
