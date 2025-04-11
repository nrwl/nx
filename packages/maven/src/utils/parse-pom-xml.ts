import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseString } from 'xml2js';
import { promisify } from 'node:util';

const parseXml = promisify(parseString);

export interface MavenProjectInfo {
  groupId: string;
  artifactId: string;
  version: string;
  packaging: string;
  modules?: string[];
  dependencies?: Array<{
    groupId: string;
    artifactId: string;
    version: string;
  }>;
}

export interface MavenReport {
  projects: Map<string, MavenProjectInfo>;
  projectToModules: Map<string, string[]>;
}

export async function parsePomXml(
  workspaceRoot: string,
  pomFiles: string[]
): Promise<MavenReport> {
  const report: MavenReport = {
    projects: new Map(),
    projectToModules: new Map(),
  };

  for (const pomFile of pomFiles) {
    try {
      const pomContent = readFileSync(join(workspaceRoot, pomFile), 'utf-8');
      const parsed = await parseXml(pomContent);
      const project = parsed.project;

      if (!project) {
        continue;
      }

      const projectInfo: MavenProjectInfo = {
        groupId: project.groupId?.[0] || project.parent?.[0]?.groupId?.[0] || '',
        artifactId: project.artifactId?.[0] || '',
        version: project.version?.[0] || project.parent?.[0]?.version?.[0] || '',
        packaging: project.packaging?.[0] || 'jar',
      };

      // Parse modules if present
      if (project.modules?.[0]?.module) {
        projectInfo.modules = project.modules[0].module;
        report.projectToModules.set(pomFile, projectInfo.modules);
      }

      // Parse dependencies if present
      if (project.dependencies?.[0]?.dependency) {
        projectInfo.dependencies = project.dependencies[0].dependency.map(
          (dep: any) => ({
            groupId: dep.groupId?.[0] || '',
            artifactId: dep.artifactId?.[0] || '',
            version: dep.version?.[0] || '',
          })
        );
      }

      report.projects.set(pomFile, projectInfo);
    } catch (e) {
      console.error(`Error parsing POM file ${pomFile}:`, e);
    }
  }

  return report;
} 