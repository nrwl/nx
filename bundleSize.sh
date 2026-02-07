rm -rf dist
rm -rf packages/cli/dist
rm -rf packages/fluff/dist
nx build cli && nx build fluff
npm run cli build fluff-demo-app
cd packages/fluff/
node bundle-size.js
cd ../..
stat -c "%s" dist/apps/fluff-demo-app/fluff-app.js.gz | awk '{printf "Demo app size: %.2f KB (%d bytes)\n", $1/1024, $1}'

