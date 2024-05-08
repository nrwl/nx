import { nxVersion } from '../../utils/versions';
import { coreNxPluginVersions } from './add';

describe('nx core packages', () => {
  it('should map nx packages to nx version', () => {
    expect(coreNxPluginVersions.get('@nx/workspace')).toEqual(nxVersion);
  });

  it('should map nx-cloud to latest', () => {
    expect(coreNxPluginVersions.get('@nrwl/nx-cloud')).toEqual('latest');
    expect(coreNxPluginVersions.get('nx-cloud')).toEqual('latest');
  });
});
