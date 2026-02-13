import { stringify } from 'querystring';
import * as https from 'https';
import * as os from 'os';
import { parse } from 'semver';
import { randomUUID } from 'crypto';
import {
  RequestParameter,
  ParameterValue,
  UserCustomDimension,
} from './parameter';
import { logger } from '../utils/logger';

const TRACKING_ID_PROD = 'G-83SJXKY605';

export class AnalyticsCollector {
  private eventsQueue: Record<string, ParameterValue | undefined>[] | undefined;
  private pageViewQueue:
    | Record<string, ParameterValue | undefined>[]
    | undefined;
  private commonRequestParameters: Partial<
    Record<RequestParameter, ParameterValue | undefined>
  >;
  private userParameters: Record<
    UserCustomDimension,
    ParameterValue | undefined
  >;

  constructor(
    workspaceId: string,
    userId: string,
    nxVersion: string,
    packageManagerInfo: { name: string; version?: string }
  ) {
    const { major: nxMajorVersion } = parse(nxVersion);
    this.commonRequestParameters = {
      [RequestParameter.ProtocolVersion]: 2,
      [RequestParameter.ClientId]: workspaceId,
      [RequestParameter.UserId]: userId,
      [RequestParameter.TrackingId]: TRACKING_ID_PROD,

      // Built-in user properties
      [RequestParameter.SessionId]: randomUUID(),
      [RequestParameter.UserAgentArchitecture]: os.arch(),
      [RequestParameter.UserAgentPlatform]: os.platform(),
      [RequestParameter.UserAgentPlatformVersion]: os.release(),
      [RequestParameter.UserAgentMobile]: 0,
      [RequestParameter.SessionEngaged]: 1,
      // The below is needed for tech details to be collected.
      [RequestParameter.UserAgentFullVersionList]:
        'Google%20Chrome;111.0.5563.64|Not(A%3ABrand;8.0.0.0|Chromium;111.0.5563.64',
    };

    this.commonRequestParameters[RequestParameter.DebugView] = 1;

    const nodeVersion = parse(process.version);

    this.userParameters = {
      // While architecture is being collect by GA as UserAgentArchitecture.
      // It doesn't look like there is a way to query this. Therefore we collect this as a custom user dimension too.
      [UserCustomDimension.OsArchitecture]: os.arch(),
      // While User ID is being collected by GA, this is not visible in reports/for filtering.
      [UserCustomDimension.UserId]: userId,
      [UserCustomDimension.NodeVersion]: nodeVersion
        ? `${nodeVersion.major}.${nodeVersion.minor}.${nodeVersion.patch}`
        : 'other',
      [UserCustomDimension.PackageManager]: packageManagerInfo.name,
      [UserCustomDimension.PackageManagerVersion]: packageManagerInfo.version,
      [UserCustomDimension.NxVersion]: nxVersion,
    };
  }

  async flush(): Promise<void> {
    const pendingEvents =
      (this.eventsQueue?.length ?? 0) + (this.pageViewQueue?.length ?? 0);
    logger.verbose(`Analytics Flush: ${pendingEvents} events.`);

    if (!pendingEvents) {
      return;
    }

    try {
      await this.send();
    } catch (error) {
      // Failure to report analytics shouldn't crash the CLI.
      logger.verbose(`Analytics Send Error: ${error.message}.`);
    } finally {
      // Prevents reporting the same event multiple times.
      this.eventsQueue = undefined;
      this.pageViewQueue = undefined;
    }
  }

  event(
    eventName: string,
    parameters?: Record<string, ParameterValue>,
    isPageView?: boolean,
    pageLocation?: string
  ): void {
    this.eventsQueue ??= [];
    this.pageViewQueue ??= [];

    const eventData: Record<string, ParameterValue | undefined> = {
      ...this.userParameters,
      ...parameters,
      en: isPageView ? 'page_view' : eventName,
    };

    // For page views, capture the command name as page location/title
    if (isPageView) {
      eventData[RequestParameter.PageLocation] = pageLocation ?? eventName;
      eventData[RequestParameter.PageTitle] = eventName;
      this.pageViewQueue.push(eventData);
    } else {
      this.eventsQueue.push(eventData);
    }
  }

  serialize(): string {
    return JSON.stringify({
      events: this.eventsQueue ?? [],
      pageViews: this.pageViewQueue ?? [],
      commonRequestParameters: this.commonRequestParameters,
      userParameters: this.userParameters,
    });
  }

  deserialize(serialized: string): void {
    const { events, pageViews, commonRequestParameters, userParameters } =
      JSON.parse(serialized);
    this.eventsQueue = events;
    this.pageViewQueue = pageViews;
    this.commonRequestParameters = commonRequestParameters;
    this.userParameters = userParameters;
  }

  static fromSerialized(serialized: string): AnalyticsCollector {
    const collector = new AnalyticsCollector('_', '', '0.0.0', {
      name: 'npm',
    });
    collector.deserialize(serialized);
    return collector;
  }

  private async send() {
    const eventsPromise = this.createRequest(
      this.commonRequestParameters,
      this.eventsQueue ?? []
    );
    const pageViewsPromises = [];
    for (const pageView of this.pageViewQueue ?? []) {
      pageViewsPromises.push(
        this.createRequest(
          {
            ...this.commonRequestParameters,
            [RequestParameter.PageTitle]: pageView[RequestParameter.PageTitle],
            [RequestParameter.PageLocation]:
              pageView[RequestParameter.PageLocation],
          },
          [pageView]
        )
      );
    }
    return Promise.allSettled([eventsPromise, ...pageViewsPromises]);
  }

  private createRequest(
    parameters: Partial<Record<RequestParameter, ParameterValue | undefined>>,
    data: Record<string, ParameterValue>[]
  ) {
    return new Promise<void>((resolve, reject) => {
      const stringifiedRequestParameters = stringify(parameters);
      const request = https.request(
        {
          host: 'www.google-analytics.com',
          method: 'POST',
          path: '/g/collect?' + stringifiedRequestParameters,
          headers: {
            // The below is needed for tech details to be collected even though we provide our own information from the OS Node.js module
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
          },
        },
        (response) => {
          // The below is needed as otherwise the response will never close which will cause the CLI not to terminate.
          response.on('data', () => {});

          if (response.statusCode !== 200 && response.statusCode !== 204) {
            reject(
              new Error(
                `Analytics Reporting Failed: with status code: ${response.statusCode}.`
              )
            );
          } else {
            resolve();
          }
        }
      );

      request.on('error', reject);
      const queryParameters = data.map((p) => stringify(p)).join('\n');
      request.write(queryParameters);
      request.end();
    });
  }
}
