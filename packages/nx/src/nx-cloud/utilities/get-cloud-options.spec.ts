import { TempFs } from '../../internal-testing-utils/temp-fs';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { getCloudUrl } from './get-cloud-options';

describe('getCloudUrl', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('get-cloud-url');
  });

  afterEach(() => {
    fs.cleanup();
  });

  const withoutCloudEnv = <T>(callback: () => T) =>
    withEnvironmentVariables(
      { NX_CLOUD_API: undefined, NRWL_API: undefined },
      callback
    );

  it('should default to https://cloud.nx.app', () => {
    fs.createFileSync('nx.json', JSON.stringify({}));

    expect(withoutCloudEnv(() => getCloudUrl())).toBe('https://cloud.nx.app');
  });

  it('should use nxCloudUrl from nx.json', () => {
    fs.createFileSync(
      'nx.json',
      JSON.stringify({ nxCloudUrl: 'https://nx-cloud.acme.example/' })
    );

    expect(withoutCloudEnv(() => getCloudUrl())).toBe(
      'https://nx-cloud.acme.example'
    );
  });

  it('should use the url of the default tasks runner options', () => {
    fs.createFileSync(
      'nx.json',
      JSON.stringify({
        tasksRunnerOptions: {
          default: { options: { url: 'https://nx-cloud.acme.example' } },
        },
      })
    );

    expect(withoutCloudEnv(() => getCloudUrl())).toBe(
      'https://nx-cloud.acme.example'
    );
  });

  it('should read nx.json from the given directory', () => {
    fs.createFileSync('nx.json', JSON.stringify({}));
    fs.createFileSync(
      'other/nx.json',
      JSON.stringify({ nxCloudUrl: 'https://nx-cloud.acme.example' })
    );

    expect(withoutCloudEnv(() => getCloudUrl(`${fs.tempDir}/other`))).toBe(
      'https://nx-cloud.acme.example'
    );
  });

  it('should let NX_CLOUD_API override nxCloudUrl', () => {
    fs.createFileSync(
      'nx.json',
      JSON.stringify({ nxCloudUrl: 'https://nx-cloud.acme.example' })
    );

    expect(
      withEnvironmentVariables(
        { NX_CLOUD_API: 'https://eu.nx.app', NRWL_API: undefined },
        () => getCloudUrl()
      )
    ).toBe('https://eu.nx.app');
  });
});
