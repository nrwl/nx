process.on('message', function (message) {
  if (message === 'Bye') {
    process.send('Bye');
    process.exit(0);
  } else {
    process.send(`Hello ${message}`);
  }
});
