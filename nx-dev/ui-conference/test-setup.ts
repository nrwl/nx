export class MockPerformanceObserver {
  disconnect() {
    //empty
  }

  observe() {
    //empty
  }

  takeRecords() {
    return [];
  }
}
(global as any).PerformanceObserver = MockPerformanceObserver;
