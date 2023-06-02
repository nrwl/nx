import { fileHasher } from '../../hasher/impl';

export async function handleRequestFileData() {
  const response = JSON.stringify(fileHasher.allFileData());
  return {
    response,
    description: 'handleRequestFileData',
  };
}
