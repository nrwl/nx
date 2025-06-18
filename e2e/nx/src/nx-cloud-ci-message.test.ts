import { cleanupProject, newProject, runCLI, updateJson } from '@nx/e2e/utils';

describe('nx-cloud CI message', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/js'] });
  });

  afterAll(() => cleanupProject());

  it('should show warning when running in CI without nx-cloud', () => {
    // Remove nx-cloud if present
    updateJson('package.json', (json) => {
      delete json.dependencies?.['nx-cloud'];
      delete json.devDependencies?.['nx-cloud'];
      delete json.dependencies?.['@nrwl/nx-cloud'];
      delete json.devDependencies?.['@nrwl/nx-cloud'];
      return json;
    });

    // Remove any nx-cloud configuration
    updateJson('nx.json', (json) => {
      delete json.nxCloudAccessToken;
      delete json.nxCloudId;
      delete json.tasksRunnerOptions?.default?.options?.accessToken;
      return json;
    });

    // Run a command in CI mode
    const output = runCLI('run-many -t build', {
      env: { CI: 'true' },
    });

    expect(output).toContain('NX SETUP WARNING: Remote caching disabled');
    expect(output).toContain('https://cloud.nx.app/get-started');
  });

  it('should not show warning when nx-cloud is installed', () => {
    // Add nx-cloud to package.json
    updateJson('package.json', (json) => {
      json.devDependencies = json.devDependencies || {};
      json.devDependencies['nx-cloud'] = 'latest';
      return json;
    });

    const output = runCLI('run-many -t build', {
      env: { CI: 'true' },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });

  it('should not show warning when nx-cloud token is configured', () => {
    // Remove nx-cloud from package.json
    updateJson('package.json', (json) => {
      delete json.devDependencies?.['nx-cloud'];
      delete json.dependencies?.['nx-cloud'];
      return json;
    });

    // Add nx-cloud token
    updateJson('nx.json', (json) => {
      json.nxCloudAccessToken = 'test-token';
      return json;
    });

    const output = runCLI('run-many -t build', {
      env: { CI: 'true' },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });

  it('should not show warning when not in CI', () => {
    // Remove nx-cloud
    updateJson('package.json', (json) => {
      delete json.devDependencies?.['nx-cloud'];
      delete json.dependencies?.['nx-cloud'];
      return json;
    });

    // Remove nx-cloud configuration
    updateJson('nx.json', (json) => {
      delete json.nxCloudAccessToken;
      delete json.nxCloudId;
      return json;
    });

    // Run without CI environment variable
    const output = runCLI('run-many -t build', {
      env: { CI: 'false' },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });

  it('should show warning only once for multiple tasks', () => {
    // Remove nx-cloud
    updateJson('package.json', (json) => {
      delete json.devDependencies?.['nx-cloud'];
      delete json.dependencies?.['nx-cloud'];
      return json;
    });

    // Remove nx-cloud configuration
    updateJson('nx.json', (json) => {
      delete json.nxCloudAccessToken;
      delete json.nxCloudId;
      return json;
    });

    // Run multiple tasks
    const output = runCLI('run-many -t build,test,lint', {
      env: { CI: 'true' },
    });

    // Count occurrences of the warning title
    const warningCount = (output.match(/NX SETUP WARNING/g) || []).length;
    expect(warningCount).toBe(1);
  });

  it('should not show warning when s3 configuration exists in nx.json', () => {
    // Add s3 configuration to nx.json
    updateJson('nx.json', (json) => {
      json.s3 = {
        region: 'us-east-1',
        bucket: 'my-bucket',
      };
      return json;
    });

    const output = runCLI('run-many -t build', {
      env: { CI: 'true' },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });

  it('should not show warning when gcs configuration exists in nx.json', () => {
    // Add gcs configuration to nx.json
    updateJson('nx.json', (json) => {
      json.gcs = {
        bucket: 'my-bucket',
      };
      return json;
    });

    const output = runCLI('run-many -t build', {
      env: { CI: 'true' },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });

  it('should not show warning when azure configuration exists in nx.json', () => {
    // Add azure configuration to nx.json
    updateJson('nx.json', (json) => {
      json.azure = {
        container: 'my-container',
        accountName: 'my-account',
      };
      return json;
    });

    const output = runCLI('run-many -t build', {
      env: { CI: 'true' },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });

  it('should not show warning when sharedFs configuration exists in nx.json', () => {
    // Add sharedFs configuration to nx.json
    updateJson('nx.json', (json) => {
      json.sharedFs = {
        path: '/some/path',
      };
      return json;
    });

    const output = runCLI('run-many -t build', {
      env: { CI: 'true' },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });

  it('should not show warning when NX_SELF_HOSTED_REMOTE_CACHE_SERVER is set', () => {
    // Remove nx-cloud
    updateJson('package.json', (json) => {
      delete json.dependencies?.['nx-cloud'];
      delete json.devDependencies?.['nx-cloud'];
      delete json.dependencies?.['@nrwl/nx-cloud'];
      delete json.devDependencies?.['@nrwl/nx-cloud'];
      return json;
    });

    const output = runCLI('run-many -t build', {
      env: {
        CI: 'true',
        NX_SELF_HOSTED_REMOTE_CACHE_SERVER: 'http://localhost:3000',
      },
    });

    expect(output).not.toContain('NX SETUP WARNING');
  });
});
