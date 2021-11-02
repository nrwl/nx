export class MockPerformanceObserver implements PerformanceObserver {
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
