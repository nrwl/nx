import { getHistoryForHashes } from '../../utils/task-history';

export async function handleGetTaskHistoryForHashes(hashes: string[]) {
  const history = await getHistoryForHashes(hashes);
  return {
    response: JSON.stringify(history),
    description: 'handleGetTaskHistoryForHashes',
  };
}
