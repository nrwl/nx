import { AnalyticsCollector } from './analytics-collector';
import { RequestParameter } from './parameter';

describe('AnalyticsCollector', () => {
  let collector: AnalyticsCollector;

  beforeEach(() => {
    collector = new AnalyticsCollector('test-workspace', 'test-user', '1.0.0', {
      name: 'npm',
      version: '9.0.0',
    });
  });

  describe('event()', () => {
    it('should set PageLocation to pageLocation when provided for page views', () => {
      collector.event(
        'run-many',
        {},
        true,
        'run-many?verbose=true&targets=build'
      );

      const serialized = JSON.parse(collector.serialize());
      expect(serialized.pageViews).toHaveLength(1);
      expect(serialized.pageViews[0][RequestParameter.PageLocation]).toBe(
        'run-many?verbose=true&targets=build'
      );
      expect(serialized.pageViews[0][RequestParameter.PageTitle]).toBe(
        'run-many'
      );
    });

    it('should fall back to eventName for PageLocation when pageLocation is not provided', () => {
      collector.event('run-many', {}, true);

      const serialized = JSON.parse(collector.serialize());
      expect(serialized.pageViews).toHaveLength(1);
      expect(serialized.pageViews[0][RequestParameter.PageLocation]).toBe(
        'run-many'
      );
      expect(serialized.pageViews[0][RequestParameter.PageTitle]).toBe(
        'run-many'
      );
    });

    it('should not set PageLocation or PageTitle for non-page-view events', () => {
      collector.event('custom_event', {}, false);

      const serialized = JSON.parse(collector.serialize());
      expect(serialized.events).toHaveLength(1);
      expect(
        serialized.events[0][RequestParameter.PageLocation]
      ).toBeUndefined();
      expect(serialized.events[0][RequestParameter.PageTitle]).toBeUndefined();
    });
  });

  describe('send()', () => {
    it('should use PageLocation from event data in the request parameters', async () => {
      const createRequestSpy = jest.spyOn(collector as any, 'createRequest');
      createRequestSpy.mockResolvedValue(undefined);

      collector.event('run-many', {}, true, 'run-many?verbose=true');
      await collector.flush();

      expect(createRequestSpy).toHaveBeenCalledTimes(2);
      // The second call is for page views
      const pageViewRequestParams = createRequestSpy.mock.calls[1][0];
      expect(pageViewRequestParams[RequestParameter.PageLocation]).toBe(
        'run-many?verbose=true'
      );
      expect(pageViewRequestParams[RequestParameter.PageTitle]).toBe(
        'run-many'
      );
    });
  });
});
