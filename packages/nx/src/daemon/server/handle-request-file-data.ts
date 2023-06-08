import { fileHasher } from '../../hasher/file-hasher';

export async function handleRequestFileData() {
  const response = JSON.stringify(fileHasher.allFileData());
  return {
    response,
    description: 'handleRequestFileData',
  };
}
