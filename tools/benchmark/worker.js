const { fib, dist } = require('cpu-benchmark');

const data = [];
const passes = 100;
for (let i = 0; i < passes; i++) {
  const duration = fib(41); // Returns time required (ms)
  // to calculate the 41. fibonacci number recursively.
  const ops = dist(1000); // Returns the amount of operations
  // (distance matrix calculations) in 1000ms

  data.push({ duration, ops });
}

const avgDuration = data.reduce((acc, d) => acc + d.duration, 0) / data.length;
const avgOps = data.reduce((acc, d) => acc + d.ops, 0) / data.length;

console.log(avgDuration, `average duration over ${passes} passes`); // Average duration
console.log(avgOps, `average ops over ${passes} passes`); // Average ops
