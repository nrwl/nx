import { PerformanceObserver } from 'perf_hooks';

let initialized = false;
const measurements: Map<string, number[]> = new Map();

if (process.env.NX_PERF_LOGGING === 'true' && !initialized) {
  initialized = true;

  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`Time for '${entry.name}'`, entry.duration);

      // Only aggregate DB operations for summary
      if (entry.name.startsWith('db:')) {
        if (!measurements.has(entry.name)) {
          measurements.set(entry.name, []);
        }
        measurements.get(entry.name)!.push(entry.duration);
      }
    }
  });
  obs.observe({ entryTypes: ['measure'] });

  process.on('exit', () => {
    if (!global.NX_PLUGIN_WORKER && measurements.size > 0) {
      console.log('\n=== DB Operations Performance Summary ===');
      let totalTime = 0;

      for (const [name, durations] of measurements) {
        const total = durations.reduce((a, b) => a + b, 0);
        totalTime += total;
        console.log(
          `${name}: count=${durations.length}, total=${total.toFixed(
            2
          )}ms, avg=${(total / durations.length).toFixed(2)}ms`
        );
      }

      console.log(`\nTotal DB time: ${totalTime.toFixed(2)}ms`);
      console.log('==========================================\n');
    }
  });
}
