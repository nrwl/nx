let x = 0;
const sayHI = () => {
  process.send(`hi from child ${x++}`);
};

process.on('SIGTERM', () => {
  console.log('child process is termed');
  process.exit(0);
});

setInterval(sayHI, 250);

setTimeout(() => {
  process.exit(1);
}, 2000);
