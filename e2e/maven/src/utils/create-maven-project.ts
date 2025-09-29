import { e2eConsoleLogger, runCommand, tmpProjPath } from '@nx/e2e-utils';
import { execSync } from 'child_process';
import { createFileSync, writeFileSync, mkdirSync } from 'fs-extra';
import { join } from 'path';
import { readFileSync } from 'fs';

export function createMavenProject(
  projectName: string,
  cwd: string = tmpProjPath(),
  addProjectJsonNamePrefix: string = ''
) {
  e2eConsoleLogger(`Using java version: ${execSync('java -version 2>&1')}`);
  e2eConsoleLogger(`Using maven version: ${execSync('mvn --version')}`);

  // Use Spring Initializr to create a realistic multi-module Maven project
  e2eConsoleLogger(
    'Creating Spring Boot multi-module project using Spring Initializr...'
  );

  try {
    // Generate the parent project
    execSync(
      `curl https://start.spring.io/starter.zip ` +
        `-d type=maven-project ` +
        `-d language=java ` +
        `-d bootVersion=3.2.0 ` +
        `-d baseDir=. ` +
        `-d groupId=com.example ` +
        `-d artifactId=${projectName} ` +
        `-d name=${projectName} ` +
        `-d packageName=com.example ` +
        `-d packaging=pom ` +
        `-d javaVersion=17 ` +
        `-o ${projectName}.zip`,
      { cwd, stdio: 'pipe' }
    );

    // Unzip the project
    execSync(`unzip -q -o ${projectName}.zip`, { cwd });
    execSync(`rm ${projectName}.zip`, { cwd });

    // Update the parent POM to be a proper multi-module parent
    const parentPomPath = join(cwd, 'pom.xml');
    let parentPom = readFileSync(parentPomPath, 'utf-8');

    // Change packaging to pom
    parentPom = parentPom.replace(
      /<packaging>jar<\/packaging>/,
      '<packaging>pom</packaging>'
    );

    // Add modules section before </project>
    parentPom = parentPom.replace(
      /<\/project>/,
      `
  <modules>
    <module>app</module>
    <module>lib</module>
    <module>utils</module>
  </modules>
</project>`
    );

    writeFileSync(parentPomPath, parentPom);

    // Create the sub-modules
    createModule(cwd, 'app', projectName, ['lib'], addProjectJsonNamePrefix);
    createModule(cwd, 'lib', projectName, ['utils'], addProjectJsonNamePrefix);
    createModule(cwd, 'utils', projectName, [], addProjectJsonNamePrefix);

    // Remove the parent project's src directory since it's just a parent POM
    try {
      execSync(`rm -rf ${join(cwd, 'src')}`, { stdio: 'pipe' });
    } catch {}

    e2eConsoleLogger('Created Maven multi-module project with Spring Boot');
  } catch (error) {
    e2eConsoleLogger(
      `Failed to use Spring Initializr, falling back to manual creation: ${error}`
    );
    createMavenProjectManually(projectName, cwd, addProjectJsonNamePrefix);
  }
}

function createModule(
  basePath: string,
  moduleName: string,
  parentArtifactId: string,
  dependencies: string[],
  addProjectJsonNamePrefix: string = ''
) {
  const modulePath = join(basePath, moduleName);

  e2eConsoleLogger(`Creating ${moduleName} module...`);

  try {
    // Generate Spring Boot module
    execSync(
      `curl https://start.spring.io/starter.zip ` +
        `-d type=maven-project ` +
        `-d language=java ` +
        `-d bootVersion=3.2.0 ` +
        `-d baseDir=${moduleName} ` +
        `-d groupId=com.example ` +
        `-d artifactId=${moduleName} ` +
        `-d name=${capitalize(moduleName)} ` +
        `-d packageName=com.example.${moduleName} ` +
        `-d packaging=jar ` +
        `-d javaVersion=17 ` +
        `-d dependencies=web ` +
        `-o ${moduleName}.zip`,
      { cwd: basePath, stdio: 'pipe' }
    );

    // Unzip the module
    execSync(`unzip -q -o ${moduleName}.zip -d .`, { cwd: basePath });
    execSync(`rm ${moduleName}.zip`, { cwd: basePath });

    // Update the module's POM to reference parent
    const pomPath = join(modulePath, 'pom.xml');
    let pomContent = readFileSync(pomPath, 'utf-8');

    // Add parent section after <modelVersion>
    pomContent = pomContent.replace(
      /<modelVersion>4\.0\.0<\/modelVersion>/,
      `<modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>com.example</groupId>
    <artifactId>${parentArtifactId}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>`
    );

    // Remove version and groupId since they're inherited from parent
    pomContent = pomContent.replace(/<version>.*?<\/version>/, '');
    pomContent = pomContent.replace(/<groupId>com\.example<\/groupId>/, '');

    // Add project dependencies if any
    if (dependencies.length > 0) {
      const depsXml = dependencies
        .map(
          (dep) => `    <dependency>
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
  } catch (error) {
    e2eConsoleLogger(
      `Failed to create ${moduleName} with Spring Initializr, using manual creation: ${error}`
    );
    createModuleManually(
      basePath,
      moduleName,
      parentArtifactId,
      dependencies,
      addProjectJsonNamePrefix
    );
  }
}

function createMavenProjectManually(
  projectName: string,
  cwd: string,
  addProjectJsonNamePrefix: string
) {
  // Create parent POM
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
    <spring-boot.version>3.2.0</spring-boot.version>
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

  writeFileSync(join(cwd, 'pom.xml'), parentPom);

  // Create modules manually
  createModuleManually(cwd, 'app', projectName, ['lib'], addProjectJsonNamePrefix);
  createModuleManually(
    cwd,
    'lib',
    projectName,
    ['utils'],
    addProjectJsonNamePrefix
  );
  createModuleManually(cwd, 'utils', projectName, [], addProjectJsonNamePrefix);

  e2eConsoleLogger('Created Maven multi-module project manually');
}

function createModuleManually(
  basePath: string,
  moduleName: string,
  parentArtifactId: string,
  dependencies: string[],
  addProjectJsonNamePrefix: string = ''
) {
  const modulePath = join(basePath, moduleName);
  const srcPath = join(modulePath, 'src/main/java/com/example');
  const testPath = join(modulePath, 'src/test/java/com/example');

  // Create directories
  createFileSync(join(srcPath, '.gitkeep'));
  createFileSync(join(testPath, '.gitkeep'));

  // Create module POM
  const modulePom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>com.example</groupId>
    <artifactId>${parentArtifactId}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>

  <artifactId>${moduleName}</artifactId>
  <packaging>jar</packaging>

  <name>${moduleName}</name>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    ${
      dependencies.length > 0
        ? dependencies
            .map(
              (dep) => `<dependency>
      <groupId>com.example</groupId>
      <artifactId>${dep}</artifactId>
      <version>1.0.0-SNAPSHOT</version>
    </dependency>`
            )
            .join('\n    ')
        : ''
    }
  </dependencies>
</project>`;

  writeFileSync(join(modulePath, 'pom.xml'), modulePom);

  // Create a simple Java class
  const javaClass = `package com.example;

public class ${capitalize(moduleName)} {
    public String getName() {
        return "${moduleName}";
    }
}`;

  writeFileSync(join(srcPath, `${capitalize(moduleName)}.java`), javaClass);

  // Create a simple test
  const javaTest = `package com.example;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class ${capitalize(moduleName)}Test {
    @Test
    public void testGetName() {
        ${capitalize(moduleName)} obj = new ${capitalize(moduleName)}();
        assertEquals("${moduleName}", obj.getName());
    }
}`;

  writeFileSync(join(testPath, `${capitalize(moduleName)}Test.java`), javaTest);

  // Add project.json if needed
  if (addProjectJsonNamePrefix) {
    writeFileSync(
      join(modulePath, 'project.json'),
      `{"name": "${addProjectJsonNamePrefix}${moduleName}"}`
    );
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}