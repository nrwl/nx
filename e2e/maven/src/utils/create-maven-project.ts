import {
  e2eConsoleLogger,
  tmpProjPath,
  readFile,
  updateFile,
} from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';
import {
  readFileSync,
  writeFileSync as fsWriteFileSync,
  unlinkSync,
  chmodSync,
} from 'fs';
import * as extract from 'extract-zip';

async function downloadFile(
  url: string,
  params: Record<string, string>,
  outputPath: string
): Promise<void> {
  e2eConsoleLogger(`Downloading from ${url} to ${outputPath}...`);
  e2eConsoleLogger(`Parameters: ${JSON.stringify(params, null, 2)}`);

  const formData = new URLSearchParams(params);

  e2eConsoleLogger(`Making POST request...`);
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  e2eConsoleLogger(
    `Response status: ${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    e2eConsoleLogger(`Error response body: ${errorText}`);
    throw new Error(
      `HTTP error! status: ${response.status}, body: ${errorText}`
    );
  }

  e2eConsoleLogger(`Reading response as array buffer...`);
  const buffer = await response.arrayBuffer();
  e2eConsoleLogger(`Buffer size: ${buffer.byteLength} bytes`);

  e2eConsoleLogger(`Writing to file: ${outputPath}`);
  fsWriteFileSync(outputPath, Buffer.from(buffer));
  e2eConsoleLogger(`File written successfully`);
}

export async function createMavenProject(
  projectName: string,
  cwd: string = tmpProjPath(),
  addProjectJsonNamePrefix: string = ''
) {
  e2eConsoleLogger(`Using java version: ${execSync('java -version 2>&1')}`);

  e2eConsoleLogger(
    'Creating multi-module Maven project using Spring Initializr...'
  );

  // Create parent POM (Spring Initializr doesn't support packaging=pom)
  const parentPomPath = join(cwd, 'pom.xml');
  const parentPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.example</groupId>
  <artifactId>${projectName}</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>pom</packaging>

  <name>${projectName}</name>

  <modules>
    <module>app</module>
    <module>lib</module>
    <module>utils</module>
  </modules>

  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <spring-boot.version>3.4.0</spring-boot.version>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-dependencies</artifactId>
        <version>\${spring-boot.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <build>
    <pluginManagement>
      <plugins>
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-compiler-plugin</artifactId>
          <version>3.11.0</version>
        </plugin>
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-surefire-plugin</artifactId>
          <version>3.0.0-M9</version>
        </plugin>
        <plugin>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-maven-plugin</artifactId>
          <version>\${spring-boot.version}</version>
        </plugin>
      </plugins>
    </pluginManagement>
  </build>
</project>`;

  writeFileSync(parentPomPath, parentPom);

  // Create modules with dependencies: app -> lib -> utils
  await createModule(
    cwd,
    'app',
    projectName,
    ['lib'],
    addProjectJsonNamePrefix
  );
  await createModule(
    cwd,
    'lib',
    projectName,
    ['utils'],
    addProjectJsonNamePrefix
  );
  await createModule(cwd, 'utils', projectName, [], addProjectJsonNamePrefix);

  updateFile('mvnw', readFile('app/mvnw'));
  updateFile('mvnw.cmd', readFile('app/mvnw.cmd'));
  updateFile('.mvn/wrapper/maven-wrapper.properties', readFile('app/.mvn/wrapper/maven-wrapper.properties'));

  chmodSync(join(cwd, 'mvnw'), 0o755);
  chmodSync(join(cwd, 'mvnw.cmd'), 0o755);

  e2eConsoleLogger('Created multi-module Maven project with Spring Boot');
}

async function createModule(
  basePath: string,
  moduleName: string,
  parentArtifactId: string,
  dependencies: string[],
  addProjectJsonNamePrefix: string = ''
) {
  const modulePath = join(basePath, moduleName);

  e2eConsoleLogger(`Creating ${moduleName} module...`);

  // Generate Spring Boot module
  const zipPath = join(basePath, `${moduleName}.zip`);
  await downloadFile(
    'https://start.spring.io/starter.zip',
    {
      type: 'maven-project',
      language: 'java',
      bootVersion: '3.4.0',
      baseDir: moduleName,
      groupId: 'com.example',
      artifactId: moduleName,
      name: capitalize(moduleName),
      packageName: `com.example.${moduleName}`,
      javaVersion: '17',
      dependencies: 'web',
    },
    zipPath
  );

  // Unzip the module using Node.js (cross-platform)
  e2eConsoleLogger(`Unzipping ${moduleName}.zip to ${basePath}...`);

  await extract(zipPath, { dir: basePath });

  // Delete zip file
  unlinkSync(zipPath);

  e2eConsoleLogger(`Extracted and cleaned up ${moduleName}.zip`);

  // Modify the module's POM to link to parent and add dependencies
  const pomPath = join(modulePath, 'pom.xml');
  let pomContent = readFileSync(pomPath, 'utf-8');

  // Replace Spring Boot starter parent with our custom parent
  pomContent = pomContent.replace(
    /<parent>[\s\S]*?<\/parent>/,
    `<parent>
        <groupId>com.example</groupId>
        <artifactId>${parentArtifactId}</artifactId>
        <version>1.0.0-SNAPSHOT</version>
    </parent>`
  );

  // Remove the project's standalone groupId and version (after </parent>, before <artifactId>)
  // Match from after </parent> to before </project> to avoid touching parent's groupId
  pomContent = pomContent.replace(
    /(<\/parent>[\s\S]*?)<groupId>com\.example<\/groupId>\s*/,
    '$1'
  );
  pomContent = pomContent.replace(
    /(<\/parent>[\s\S]*?)<version>[^<]*<\/version>\s*(?=<name>)/,
    '$1'
  );

  // Add inter-module dependencies if any
  if (dependencies.length > 0) {
    const depsXml = dependencies
      .map(
        (dep) => `        <dependency>
            <groupId>com.example</groupId>
            <artifactId>${dep}</artifactId>
            <version>1.0.0-SNAPSHOT</version>
        </dependency>`
      )
      .join('\n');

    pomContent = pomContent.replace(
      /<dependencies>/,
      `<dependencies>\n${depsXml}`
    );
  }

  writeFileSync(pomPath, pomContent);

  // Add project.json if needed
  if (addProjectJsonNamePrefix) {
    writeFileSync(
      join(modulePath, 'project.json'),
      `{"name": "${addProjectJsonNamePrefix}${moduleName}"}`
    );
  }

  e2eConsoleLogger(`Created ${moduleName} module`);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
