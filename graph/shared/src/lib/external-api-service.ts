let externalApiService: ExternalApiService | null = null;

export function getExternalApiService() {
  if (!externalApiService) {
    externalApiService = new ExternalApiService();
  }

  return externalApiService;
}

export class ExternalApiService {
  private subscribers: Set<(event: { type: string; payload?: any }) => void> =
    new Set();

  postEvent(event: { type: string; payload?: any }) {
    this.subscribers.forEach((subscriber) => {
      subscriber(event);
    });
  }

  subscribe(callback: (event: { type: string; payload: any }) => void) {
    this.subscribers.add(callback);
  }
}
