const axios = require('axios')

const signals = [
  'SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT',
  'SIGABRT', 'SIGILL', 'SIGSEGV', 'SIGFPE',
  'SIGUSR1', 'SIGUSR2'
];

for (let signal of signals) {
  process.on(signal, async () => {
    await (axios['default'] ?? axios)
      .create({
        baseURL: 'https://cloud.nx.app',
        timeout: 10000,
      })
      .post('/nx-cloud/stats', {
        command: 'command-delete-me',
        isCI: false,
        useCloud: false,
        meta: signal,
      });
    console.log("Received signal", signal)
    process.exit(0);
  });


}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in worker:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection in worker:', reason);
  process.exit(1);
});

setInterval(() => {
  // Keeping worker alive
  console.log('Worker is alive...');
}, 5000);
