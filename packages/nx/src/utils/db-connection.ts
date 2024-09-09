import { connectToNxDb, ExternalObject } from '../native';
import { workspaceDataDirectory } from './cache-directory';
import { version as NX_VERSION } from '../../package.json';

let dbConnection: ExternalObject<any>;

export function getDbConnection(directory = workspaceDataDirectory) {
  dbConnection ??= connectToNxDb(directory, NX_VERSION);
  return dbConnection;
}
