import {
  e2eConsoleLogger,
  isWindows,
  runCommand,
  tmpProjPath,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { createFileSync, writeFileSync } from 'fs-extra';
import { join, resolve } from 'path';

const kotlinVersion = '2.1.20';

export function createGradleProject(
  projectName: string,
  type: 'kotlin' | 'groovy' = 'kotlin',
  cwd: string = tmpProjPath(),
  packageName: string = 'gradleProject',
  addProjectJsonNamePrefix: string = ''
) {
  e2eConsoleLogger(`Using java version: ${execSync('java -version')}`);
  const gradleCommand = isWindows()
    ? resolve(`${__dirname}/../../../../gradlew.bat`)
    : resolve(`${__dirname}/../../../../gradlew`);
  e2eConsoleLogger(
    'Using gradle version: ' +
      execSync(`${gradleCommand} --version`, {
        cwd,
      })
  );
  e2eConsoleLogger(
    execSync(`${gradleCommand} help --task :init`, {
      cwd,
    }).toString()
  );
  e2eConsoleLogger(
    runCommand(
      `${gradleCommand} init --type ${type}-application --dsl ${type} --project-name ${projectName} --package ${packageName} --no-incubating --split-project --overwrite`,
      {
        cwd,
      }
    )
  );

  // Update Kotlin version to 2.0.21 after project creation
  if (type === 'kotlin') {
    updateKotlinVersion(cwd, type);
  }

  try {
    e2eConsoleLogger(
      runCommand(`${gradleCommand} --stop`, {
        cwd,
      })
    );
    e2eConsoleLogger(
      runCommand(`${gradleCommand} clean`, {
        cwd,
      })
    );
  } catch (e) {}

  if (addProjectJsonNamePrefix) {
    createFileSync(join(cwd, 'app/project.json'));
    writeFileSync(
      join(cwd, 'app/project.json'),
      `{"name": "${addProjectJsonNamePrefix}app"}`
    );
    createFileSync(join(cwd, 'list/project.json'));
    writeFileSync(
      join(cwd, 'list/project.json'),
      `{"name": "${addProjectJsonNamePrefix}list"}`
    );
    createFileSync(join(cwd, 'utilities/project.json'));
    writeFileSync(
      join(cwd, 'utilities/project.json'),
      `{"name": "${addProjectJsonNamePrefix}utilities"}`
    );
  }

  addLocalPluginManagement(
    join(cwd, `settings.gradle${type === 'kotlin' ? '.kts' : ''}`)
  );
  addLocalPluginManagement(
    join(cwd, `buildSrc/settings.gradle${type === 'kotlin' ? '.kts' : ''}`)
  );

  addSpringBootPlugin(
    join(cwd, `app/build.gradle${type === 'kotlin' ? '.kts' : ''}`)
  );

  e2eConsoleLogger(
    execSync(
      `${gradleCommand} :project-graph:publishToMavenLocal -PskipSign=true`,
      {
        cwd: `${__dirname}/../../../..`,
      }
    ).toString()
  );
}

function addLocalPluginManagement(filePath: string) {
  let content = readFileSync(filePath).toString();
  content =
    `pluginManagement {
    repositories {
        mavenLocal()
        gradlePluginPortal()
        mavenCentral()
        // Add other repositories if needed
    }
}
` + content;
  writeFileSync(filePath, content);
}

function updateKotlinVersion(cwd: string, type: 'kotlin' | 'groovy') {
  e2eConsoleLogger(`Updating Kotlin version to ${kotlinVersion}`);

  // Update the main build file
  const buildFilePath = join(
    cwd,
    `build.gradle${type === 'kotlin' ? '.kts' : ''}`
  );
  try {
    let buildContent = readFileSync(buildFilePath, 'utf-8');

    if (type === 'kotlin') {
      // Update Kotlin JVM plugin version in build.gradle.kts
      buildContent = buildContent.replace(
        /id\s*\(\s*["']org\.jetbrains\.kotlin\.jvm["']\s*\)\s+version\s+["'][^"']*["']/g,
        `id("org.jetbrains.kotlin.jvm") version "${kotlinVersion}"`
      );
    } else {
      // Update Kotlin JVM plugin version in build.gradle (Groovy)
      buildContent = buildContent.replace(
        /id\s+['"]org\.jetbrains\.kotlin\.jvm['"]\s+version\s+['"][^'"]*['"]/g,
        `id 'org.jetbrains.kotlin.jvm' version '${kotlinVersion}'`
      );
    }

    writeFileSync(buildFilePath, buildContent);
    e2eConsoleLogger(`Updated Kotlin version in ${buildFilePath}`);
  } catch (error) {
    e2eConsoleLogger(`Warning: Could not update ${buildFilePath}: ${error}`);
  }

  // Update subproject build files
  const subprojects = ['app', 'list', 'utilities'];
  subprojects.forEach((subproject) => {
    const subBuildFilePath = join(
      cwd,
      subproject,
      `build.gradle${type === 'kotlin' ? '.kts' : ''}`
    );
    try {
      let subBuildContent = readFileSync(subBuildFilePath, 'utf-8');

      if (type === 'kotlin') {
        // Update Kotlin JVM plugin version in subproject build.gradle.kts
        subBuildContent = subBuildContent.replace(
          /id\s*\(\s*["']org\.jetbrains\.kotlin\.jvm["']\s*\)/g,
          `id("org.jetbrains.kotlin.jvm") version "${kotlinVersion}"`
        );
      } else {
        // Update Kotlin JVM plugin version in subproject build.gradle (Groovy)
        subBuildContent = subBuildContent.replace(
          /id\s+['"]org\.jetbrains\.kotlin\.jvm['"]/g,
          `id 'org.jetbrains.kotlin.jvm' version '${kotlinVersion}'`
        );
      }

      writeFileSync(subBuildFilePath, subBuildContent);
      e2eConsoleLogger(`Updated Kotlin version in ${subBuildFilePath}`);
    } catch (error) {
      e2eConsoleLogger(
        `Warning: Could not update ${subBuildFilePath}: ${error}`
      );
    }
  });

  // Create or update gradle/libs.versions.toml if it exists
  const versionCatalogPath = join(cwd, 'gradle', 'libs.versions.toml');
  try {
    let versionContent = readFileSync(versionCatalogPath, 'utf-8');
    // Update kotlin-gradle-plugin version in version catalog
    versionContent = versionContent.replace(
      /kotlin-gradle-plugin\s*=\s*["'][^"']*["']/g,
      `kotlin-gradle-plugin = "${kotlinVersion}"`
    );
    // Also update any plain kotlin version if it exists
    versionContent = versionContent.replace(
      /^kotlin\s*=\s*["'][^"']*["']/gm,
      `kotlin = "${kotlinVersion}"`
    );
    writeFileSync(versionCatalogPath, versionContent);
    e2eConsoleLogger(`Updated Kotlin version in ${versionCatalogPath}`);
  } catch (error) {
    // Version catalog might not exist, which is fine
    e2eConsoleLogger(
      `Version catalog not found at ${versionCatalogPath}, skipping`
    );
  }
}

function addSpringBootPlugin(filePath: string) {
  let content = readFileSync(filePath).toString();
  const isKotlin = filePath.endsWith('.kts');

  // Find the plugins block and add Spring Boot plugin
  if (content.includes('plugins {')) {
    const pluginLine = isKotlin
      ? '    id("org.springframework.boot") version "+"'
      : "    id 'org.springframework.boot' version '+'";

    content = content.replace(
      /plugins\s*\{/,
      `plugins {
${pluginLine}`
    );
  }

  writeFileSync(filePath, content);
}
