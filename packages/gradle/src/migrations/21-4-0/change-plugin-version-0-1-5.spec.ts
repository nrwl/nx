import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { Tree } from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree';
import update from './change-plugin-version-0-1-5';
import { gradleProjectGraphPluginName } from '../../utils/versions';

describe('change-plugin-version-0-1-5 migration', () => {
  let tempFs: TempFs;
  let cwd: string;
  let tree: Tree;

  beforeEach(async () => {
    tempFs = new TempFs('test');
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
    tree = new FsTree(tempFs.tempDir, false);
  });

  afterEach(() => {
    jest.resetModules();
    process.chdir(cwd);
  });

  it('should update plugin version to 0.1.5 in Groovy DSL', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        plugins: ['@nx/gradle'],
      }),
      'proj/settings.gradle': '',
      'proj/build.gradle': `plugins {
    id 'java'
    id "${gradleProjectGraphPluginName}" version "0.0.1"
}`,
    });

    await update(tree);

    const content = tree.read('proj/build.gradle', 'utf-8');
    expect(content).toContain(
      `id "${gradleProjectGraphPluginName}" version "0.1.5"`
    );
    expect(content).not.toContain('version "0.0.1"');
  });

  it('should update plugin version to 0.1.5 in Kotlin DSL', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        plugins: ['@nx/gradle'],
      }),
      'proj/settings.gradle.kts': '',
      'proj/build.gradle.kts': `plugins {
    id("java")
    id("${gradleProjectGraphPluginName}") version("0.0.1")
}`,
    });

    await update(tree);

    const content = tree.read('proj/build.gradle.kts', 'utf-8');
    expect(content).toContain(
      `id("${gradleProjectGraphPluginName}") version("0.1.5")`
    );
    expect(content).not.toContain('version("0.0.1")');
  });

  it('should not update if nx.json is missing', async () => {
    await tempFs.createFiles({
      'proj/settings.gradle': '',
      'proj/build.gradle': `plugins {
    id 'java'
    id "${gradleProjectGraphPluginName}" version "0.0.1"
}`,
    });

    await update(tree);

    const content = tree.read('proj/build.gradle', 'utf-8');
    expect(content).toContain('version "0.0.1"');
    expect(content).not.toContain('version "0.1.5"');
  });

  it('should not update if Gradle plugin is not present', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({}),
      'proj/settings.gradle': '',
      'proj/build.gradle': `plugins {
    id 'java'
}`,
    });

    await update(tree);

    const content = tree.read('proj/build.gradle', 'utf-8');
    expect(content).not.toContain(gradleProjectGraphPluginName);
  });

  it('should handle multiple build.gradle files', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        plugins: ['@nx/gradle'],
      }),
      'proj1/settings.gradle': '',
      'proj1/build.gradle': `plugins {
    id 'java'
    id "${gradleProjectGraphPluginName}" version "0.0.1"
}`,
      'proj2/settings.gradle': '',
      'proj2/build.gradle': `plugins {
    id 'java'
    id "${gradleProjectGraphPluginName}" version "0.0.1"
}`,
    });

    await update(tree);

    const proj1Content = tree.read('proj1/build.gradle', 'utf-8');
    const proj2Content = tree.read('proj2/build.gradle', 'utf-8');

    expect(proj1Content).toContain(
      `id "${gradleProjectGraphPluginName}" version "0.1.5"`
    );
    expect(proj2Content).toContain(
      `id "${gradleProjectGraphPluginName}" version "0.1.5"`
    );
    expect(proj1Content).not.toContain('version "0.0.1"');
    expect(proj2Content).not.toContain('version "0.0.1"');
  });

  it('should update plugin version in libs.versions.toml with version.ref', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        plugins: ['@nx/gradle'],
      }),
      'proj/settings.gradle': '',
      'proj/build.gradle': `plugins {
    id 'java'
}`,
      'proj/gradle/libs.versions.toml': `[versions]
nx-project-graph = "0.0.1"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-project-graph" }
`,
    });

    await update(tree);

    const catalogContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
    expect(catalogContent).toContain('nx-project-graph = "0.1.5"');
    expect(catalogContent).not.toContain('nx-project-graph = "0.0.1"');
  });

  it('should update plugin version in libs.versions.toml with direct version', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        plugins: ['@nx/gradle'],
      }),
      'proj/settings.gradle': '',
      'proj/build.gradle': `plugins {
    id 'java'
}`,
      'proj/gradle/libs.versions.toml': `[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version = "0.0.1" }
`,
    });

    await update(tree);

    const catalogContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
    expect(catalogContent).toContain('version = "0.1.5"');
    expect(catalogContent).not.toContain('version = "0.0.1"');
  });

  it('should update plugin version in libs.versions.toml with simple format', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        plugins: ['@nx/gradle'],
      }),
      'proj/settings.gradle': '',
      'proj/build.gradle': `plugins {
    id 'java'
}`,
      'proj/gradle/libs.versions.toml': `[plugins]
nx-graph = "${gradleProjectGraphPluginName}:0.0.1"
`,
    });

    await update(tree);

    const catalogContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
    expect(catalogContent).toContain(`"${gradleProjectGraphPluginName}:0.1.5"`);
    expect(catalogContent).not.toContain(':0.0.1');
  });

  it('should handle both version catalog and build.gradle updates', async () => {
    await tempFs.createFiles({
      'nx.json': JSON.stringify({
        plugins: ['@nx/gradle'],
      }),
      'proj/settings.gradle': '',
      'proj/build.gradle': `plugins {
    id 'java'
    id "${gradleProjectGraphPluginName}" version "0.0.1"
}`,
      'proj/gradle/libs.versions.toml': `[versions]
nx-project-graph = "0.0.2"

[plugins]
nx-graph = { id = "${gradleProjectGraphPluginName}", version.ref = "nx-project-graph" }
`,
    });

    await update(tree);

    const buildContent = tree.read('proj/build.gradle', 'utf-8');
    const catalogContent = tree.read('proj/gradle/libs.versions.toml', 'utf-8');
    
    expect(buildContent).toContain(
      `id "${gradleProjectGraphPluginName}" version "0.1.5"`
    );
    expect(catalogContent).toContain('nx-project-graph = "0.1.5"');
    expect(buildContent).not.toContain('version "0.0.1"');
    expect(catalogContent).not.toContain('nx-project-graph = "0.0.2"');
  });
});
