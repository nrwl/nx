const fs = require('fs');
const cp = require('child_process');
fs.readdirSync('C:/lt/a');
fs.readdirSync('C:/lt/b', { withFileTypes: true });
fs.promises.readdir('C:/lt/c').then(() => {
  cp.execSync('dir C:\\lt\\d >nul');
  cp.execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    'Get-ChildItem C:/lt/e | Out-Null',
  ]);
});
