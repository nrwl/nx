import { closeDbConnection, connectToNxDb } from '../native';
import {
  getDbConnection,
  getLocalDbConnection,
  removeDbConnections,
} from './db-connection';

vi.mock('../native', () => ({
  connectToNxDb: vi.fn(() => ({})),
  closeDbConnection: vi.fn(),
}));

vi.mock('./cache-directory', () => ({
  sharedDataDirectory: vi.fn(() => '/shared/workspace-data'),
  workspaceDataDirectoryForWorkspace: vi.fn(() => '/local/workspace-data'),
}));

vi.mock('./workspace-root', () => ({ workspaceRoot: '/workspace' }));

describe.each([
  ['getDbConnection', getDbConnection, '/shared/workspace-data'],
  ['getLocalDbConnection', getLocalDbConnection, '/local/workspace-data'],
] as const)('%s', (_name, getConnection, directory) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NX_DB_NAME', undefined);
  });

  afterEach(() => {
    removeDbConnections();
    vi.unstubAllEnvs();
  });

  it.each([undefined, ''])(
    'uses the machine default when NX_DB_NAME is %j',
    (value) => {
      vi.stubEnv('NX_DB_NAME', value);

      getConnection();

      expect(connectToNxDb).toHaveBeenCalledWith(directory, undefined);
    }
  );

  it('uses NX_DB_NAME when no explicit name is provided', () => {
    vi.stubEnv('NX_DB_NAME', 'ci');

    getConnection();

    expect(connectToNxDb).toHaveBeenCalledWith(directory, 'ci');
  });

  it('prefers an explicit name over NX_DB_NAME', () => {
    vi.stubEnv('NX_DB_NAME', 'ci');

    getConnection({ dbName: 'custom' });

    expect(connectToNxDb).toHaveBeenCalledWith(directory, 'custom');
  });

  it('reuses a connection for the same resolved name', () => {
    vi.stubEnv('NX_DB_NAME', 'ci');

    const connection = getConnection();

    expect(getConnection({ dbName: 'ci' })).toBe(connection);
    expect(connectToNxDb).toHaveBeenCalledTimes(1);
  });

  it('opens separate connections when NX_DB_NAME changes', () => {
    vi.stubEnv('NX_DB_NAME', 'first');
    const first = getConnection();
    vi.stubEnv('NX_DB_NAME', 'second');
    const second = getConnection();

    expect(first).not.toBe(second);
    expect(connectToNxDb).toHaveBeenCalledTimes(2);
    expect(connectToNxDb).toHaveBeenLastCalledWith(directory, 'second');

    removeDbConnections();
    expect(closeDbConnection).toHaveBeenCalledTimes(2);
    expect(closeDbConnection).toHaveBeenCalledWith(first);
    expect(closeDbConnection).toHaveBeenCalledWith(second);
  });

  it('keeps the name "default" distinct from the machine default', () => {
    const machineDefault = getConnection();
    vi.stubEnv('NX_DB_NAME', 'default');
    const namedDefault = getConnection();

    expect(namedDefault).not.toBe(machineDefault);
    expect(connectToNxDb).toHaveBeenCalledTimes(2);
    expect(connectToNxDb).toHaveBeenLastCalledWith(directory, 'default');
  });
});
