const history: { [key: string]: string } = {};

export function storeQueryForUid(uid: string, query: string) {
  history[uid] = query;
}

export function getQueryFromUid(uid: string) {
  return history[uid];
}

export function getHistory() {
  return history;
}
