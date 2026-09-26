import { homedir } from 'os';
import { join, sep } from 'path';
import { cacheSectionLines } from './report';

describe('cacheSectionLines', () => {
  it('should report usage as a share of the max', () => {
    expect(
      cacheSectionLines({
        used: 512 * 1024 * 1024,
        max: 1024 * 1024 * 1024,
        location: '/tmp/nx-cache',
      })
    ).toEqual([
      'Cache',
      '- Usage: 512.00 MB / 1.00 GB (50.0%)',
      '- Location: /tmp/nx-cache',
    ]);
  });

  it('should omit the share when the max is unlimited', () => {
    expect(
      cacheSectionLines({
        used: 512 * 1024 * 1024,
        max: 0,
        location: '/tmp/nx-cache',
      })
    ).toEqual(['Cache', '- Usage: 512.00 MB / ∞', '- Location: /tmp/nx-cache']);
  });

  it('should elide the home directory from the location', () => {
    expect(
      cacheSectionLines({
        used: 1024,
        max: 1024,
        location: join(homedir(), '.nx', 'abc123', 'cache'),
      })[2]
    ).toEqual(`- Location: ${join('~', '.nx', 'abc123', 'cache')}`);
  });

  it('should leave a location outside the home directory absolute', () => {
    expect(
      cacheSectionLines({
        used: 1024,
        max: 1024,
        location: join(sep, 'mnt', 'build-cache'),
      })[2]
    ).toEqual(`- Location: ${join(sep, 'mnt', 'build-cache')}`);
  });

  it('should round the share to one decimal place', () => {
    expect(
      cacheSectionLines({
        used: 200 * 1024 * 1024,
        max: 100 * 1024 * 1024 * 1024,
        location: '/tmp/nx-cache',
      })[1]
    ).toEqual('- Usage: 200.00 MB / 100.00 GB (0.2%)');
  });
});
