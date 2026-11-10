import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { promisify, stripVTControlCharacters } from 'node:util';
import { createMavenProject } from './utils/create-maven-project';

describe('Maven 4 Batch Mode', () => {
  const projectName = uniq('batch-v4-test');

  const runBatchCLI = (cmd: string) => {
    return runCLI(cmd, {
      // An inherited MAVEN_HOME (e.g. from mise) would override the wrapper's Maven.
      env: { NX_BATCH_MODE: 'true', MAVEN_HOME: '' },
    });
  };

  beforeAll(async () => {
    newProject({
      preset: 'apps',
      packages: ['@nx/maven'],
    });
    await createMavenProject(projectName);

    // Update Maven wrapper to use Maven 4.0.0-rc-7
    updateFile(
      '.mvn/wrapper/maven-wrapper.properties',
      `distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/4.0.0-rc-7/apache-maven-4.0.0-rc-7-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar
`
    );

    runCLI(`add @nx/maven`);
  });

  afterAll(() => cleanupProject());

  it('should build multiple projects with run-many in batch mode using Maven 4.0.0-rc-7', () => {
    // runCLI throws on non-zero exit, so successful execution + file checks is sufficient
    runBatchCLI('run-many -t verify');
    checkFilesExist(
      'app/target/app-1.0.0-SNAPSHOT.jar',
      'lib/target/lib-1.0.0-SNAPSHOT.jar',
      'utils/target/utils-1.0.0-SNAPSHOT.jar'
    );
  });

  it('should record build state while running Maven 4 resource phases in parallel', () => {
    const output = runCLI(
      'run-many -t resources,after:resources --parallel=3 --skip-nx-cache',
      {
        env: {
          NX_BATCH_MODE: 'true',
          NX_VERBOSE_LOGGING: 'true',
          MAVEN_HOME: '',
        },
      }
    );

    expect(output).toContain('Successfully ran targets');
    expect(output).toContain('resources');
    expect(output).toContain('after:resources');
    expect(output).not.toContain('context.terminal');
    expect(output).not.toContain('Terminal.writer()');
  });

  it('should suppress HTTP payloads in verbose batches unless wire logging is requested', async () => {
    const version = await promisify(execFile)(
      process.platform === 'win32' ? 'cmd.exe' : './mvnw',
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'mvnw.cmd --version']
        : ['--version'],
      {
        cwd: tmpProjPath(),
        env: { ...process.env, MAVEN_HOME: '' },
        timeout: 60000,
        killSignal: 'SIGKILL',
      }
    );
    const versionOutput = stripVTControlCharacters(version.stdout);
    expect(versionOutput).toContain('Apache Maven 4.');
    const mavenHome = versionOutput.match(/^Maven home:\s*(.+)$/m)?.[1].trim();
    expect(mavenHome).toBeDefined();
    const runner = tmpProjPath('node_modules/@nx/maven/dist/batch-runner.jar');
    mkdirSync(tmpProjPath('.nx'), { recursive: true });
    const fixture = mkdtempSync(tmpProjPath('.nx/maven-logging-'));
    const bodyMarker = 'NX_HTTP_BODY_ONLY_7f65e2';
    const parentPath = '/test/nx/logging-parent/1.0/logging-parent-1.0.pom';
    const parent = `<project xmlns="http://maven.apache.org/POM/4.0.0">
      <modelVersion>4.0.0</modelVersion><groupId>test.nx</groupId>
      <artifactId>logging-parent</artifactId><version>1.0</version><packaging>pom</packaging>
      <!-- ${bodyMarker} -->
    </project>`;
    const requests: string[] = [];
    let responseStatus = 200;
    const server = createServer((request, response) => {
      const body =
        request.url === parentPath
          ? parent
          : request.url === `${parentPath}.sha1`
            ? createHash('sha1').update(parent).digest('hex')
            : undefined;
      if (request.method !== 'GET' || body === undefined) {
        response.writeHead(404).end();
        return;
      }
      requests.push(request.url);
      if (responseStatus === 401)
        response.setHeader('WWW-Authenticate', 'Basic realm="logging-test"');
      response
        .writeHead(responseStatus, { Connection: 'close' })
        .end(responseStatus === 200 ? body : bodyMarker);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const port = (server.address() as AddressInfo).port;
      for (const { name, wireLogging, status } of [
        { name: 'default', wireLogging: false, status: 200 },
        { name: 'wire-enabled', wireLogging: true, status: 200 },
        { name: 'missing-parent', wireLogging: false, status: 404 },
        { name: 'unauthorized-parent', wireLogging: false, status: 401 },
      ]) {
        responseStatus = status;
        requests.length = 0;
        const workspace = join(fixture, name);
        mkdirSync(join(workspace, '.mvn'), { recursive: true });
        const repository = join(workspace, 'repository');
        const settings = join(workspace, 'settings.xml');
        writeFileSync(
          settings,
          `<settings><mirrors><mirror>
          <id>logging-test</id><mirrorOf>*</mirrorOf><url>http://127.0.0.1:${port}/</url>
        </mirror></mirrors></settings>`
        );
        writeFileSync(
          join(workspace, 'pom.xml'),
          `<project xmlns="http://maven.apache.org/POM/4.0.0">
          <modelVersion>4.0.0</modelVersion><parent><groupId>test.nx</groupId>
          <artifactId>logging-parent</artifactId><version>1.0</version><relativePath/></parent>
          <artifactId>logging-consumer</artifactId><packaging>pom</packaging>
        </project>`
        );
        const project = 'test.nx:logging-consumer';
        const taskId = `${project}:validate`;
        const payload = {
          tasks: {
            [taskId]: {
              project,
              goals: ['validate'],
              args: [
                '-s',
                settings,
                '-gs',
                settings,
                `-Dmaven.repo.local=${repository}`,
              ],
            },
          },
          taskGraph: {
            roots: [taskId],
            tasks: {
              [taskId]: {
                id: taskId,
                target: { project, target: 'validate' },
                overrides: {},
                outputs: [],
                projectRoot: '.',
                parallelism: true,
              },
            },
            dependencies: { [taskId]: [] },
            continuousDependencies: { [taskId]: [] },
          },
        };
        const javaArgs = [
          `-Dmaven.home=${mavenHome}`,
          `-Duser.home=${workspace}`,
        ];
        if (wireLogging)
          javaArgs.push('-Dmaven.logger.log.org.apache.http.wire=debug');
        javaArgs.push(
          '-jar',
          runner,
          '--workspaceRoot',
          workspace,
          '--verbose'
        );
        let output = '';
        try {
          const exitCode = await new Promise<number>((resolve, reject) => {
            const child = execFile(
              process.env.JAVA_HOME
                ? join(process.env.JAVA_HOME, 'bin/java')
                : 'java',
              javaArgs,
              {
                cwd: workspace,
                timeout: 60000,
                killSignal: 'SIGKILL',
                maxBuffer: 1024 * 1024,
              },
              (error, stdout, stderr) => {
                output = stripVTControlCharacters(stdout + stderr);
                if (error && (error.code !== 1 || error.signal || error.killed))
                  reject(error);
                else resolve(error ? 1 : 0);
              }
            );
            child.stdin.on('error', (error) => {
              child.kill('SIGKILL');
              reject(error);
            });
            child.stdin.end(JSON.stringify(payload));
          });
          expect(exitCode).toBe(status === 200 ? 0 : 1);
          const results = output
            .split('\n')
            .filter((line) => line.startsWith('NX_RESULT:'));
          expect(results).toHaveLength(1);
          const result = JSON.parse(results[0].slice('NX_RESULT:'.length));
          expect(result).toMatchObject({
            task: taskId,
            result: { success: status === 200 },
          });
          expect(requests).toContain(parentPath);
          const downloadedParent = join(repository, parentPath.slice(1));
          if (status === 200) {
            expect(readFileSync(downloadedParent, 'utf8')).toBe(parent);
          } else {
            expect(existsSync(downloadedParent)).toBe(false);
            expect(result.result.terminalOutput).toMatch(
              status === 404
                ? /\b404\b.*\bNot Found\b/
                : /\b401\b.*\bUnauthorized\b/
            );
          }
          expect(output).toContain('Reading installation settings from');
          expect(output.includes(bodyMarker)).toBe(wireLogging);
        } catch (error) {
          throw new Error(`${name}: ${error}\n${output}`);
        }
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('should install successfully after restoring cached package outputs', () => {
    // Step 1: Clean target directories to simulate a clean CI checkout
    runCLI('run-many -t clean');

    // Step 2: Run package in batch mode — cache hit restores outputs (including nx-build-state.json)
    runBatchCLI('run-many -t package');
    checkFilesExist(
      'app/target/app-1.0.0-SNAPSHOT.jar',
      'lib/target/lib-1.0.0-SNAPSHOT.jar',
      'utils/target/utils-1.0.0-SNAPSHOT.jar'
    );

    // Step 3: Run install in batch mode — this requires build state from the package phase
    // to know about the main artifact.
    runBatchCLI('run-many -t install');
  });

  it('should install modules whose parent POM is flattened', () => {
    // oss flattening drops properties and dependencyManagement, so install fails
    // if a module's consumer POM is built from its raw pom.xml.
    updateFile('pom.xml', (pom) =>
      pom
        .replace(
          '<spring-boot.version>',
          '<gson.version>2.11.0</gson.version>\n    <spring-boot.version>'
        )
        .replace(
          '<module>utils</module>',
          '<module>platform</module>\n    <module>utils</module>'
        )
        .replace(
          '</pluginManagement>',
          `</pluginManagement>
    <plugins>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>flatten-maven-plugin</artifactId>
        <version>1.5.0</version>
        <configuration>
          <updatePomFile>true</updatePomFile>
          <flattenMode>oss</flattenMode>
        </configuration>
        <executions>
          <execution>
            <id>flatten</id>
            <phase>process-resources</phase>
            <goals>
              <goal>flatten</goal>
            </goals>
          </execution>
        </executions>
      </plugin>
    </plugins>`
        )
    );
    updateFile(
      'platform/pom.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.example</groupId>
    <artifactId>${projectName}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>
  <artifactId>platform</artifactId>
  <packaging>pom</packaging>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>com.google.code.gson</groupId>
        <artifactId>gson</artifactId>
        <version>\${gson.version}</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
</project>`
    );
    updateFile('utils/pom.xml', (pom) =>
      pom
        .replace(
          `<artifactId>${projectName}</artifactId>`,
          `<artifactId>platform</artifactId>\n        <relativePath>../platform/pom.xml</relativePath>`
        )
        .replace(
          '<dependencies>',
          `<dependencies>
        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
        </dependency>`
        )
    );
    runCLI('reset');

    runBatchCLI('run-many -t install --skip-nx-cache');
  });

  it('should fail when unit test fails', () => {
    // Add a failing unit test
    updateFile(
      'app/src/test/java/com/example/app/AppApplicationTests.java',
      `package com.example.app;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.fail;

@SpringBootTest
class AppApplicationTests {
    @Test
    void contextLoads() {
    }

    @Test
    void thisTestShouldFail() {
        fail("This test is intentionally failing");
    }
}`
    );

    // Expect the command to throw due to test failure and verify error is printed
    let error: any;
    try {
      runBatchCLI('run-many -t verify');
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.stdout || error.stderr).toContain('thisTestShouldFail');
  });

  it('should clean multiple projects with run-many in batch mode', () => {
    // Regression test for https://github.com/nrwl/nx/issues/34757
    // clean targets are fast and run in parallel, which previously caused
    // workers to exit prematurely when the task queue was momentarily empty.
    const output = runBatchCLI('run-many -t clean');
    expect(output).toContain('Successfully ran target clean');
  });
});
