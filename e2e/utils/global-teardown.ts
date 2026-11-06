import { reportPressureProbe, reportSuiteDisk } from './pressure-probe';

export default function () {
  reportSuiteDisk();
  if (global.e2eTeardown) {
    global.e2eTeardown();
    console.log('Killed local registry process');
  }
  reportPressureProbe();
}
