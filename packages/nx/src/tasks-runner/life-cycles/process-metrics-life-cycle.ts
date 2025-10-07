import { writeFileSync } from 'fs';
import { LifeCycle } from '../life-cycle';
import {
  getProcessMetricsService,
  MetricsUpdate,
} from '../process-metrics-service';

/**
 * Throwaway life cycle only used for debugging purposes
 */
export class ProcessMetricsLifeCycle implements LifeCycle {
  private collectedMetrics: MetricsUpdate[] = [];

  constructor() {
    // Subscribe to metrics data
    getProcessMetricsService().subscribe((event) => {
      this.collectedMetrics.push(event);
    });
  }

  endCommand(): void {
    try {
      this.saveMetricsToFile('nx-process-metrics.json', this.collectedMetrics);
    } finally {
      getProcessMetricsService().shutdown();
      this.collectedMetrics = [];
    }
  }

  private saveMetricsToFile(
    filePath: string,
    metricsData: MetricsUpdate[]
  ): void {
    const data = {
      events: metricsData.length,
      metricsData,
    };

    writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
