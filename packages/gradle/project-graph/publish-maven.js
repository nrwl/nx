'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const tslib_1 = require('tslib');
const axios_1 = tslib_1.__importDefault(require('axios'));
const fs = tslib_1.__importStar(require('fs'));
const FormData = tslib_1.__importStar(require('form-data'));
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  args.forEach((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    result[key] = value;
  });
  return result;
}
async function publishToMavenApi(
  username,
  password,
  deploymentZipPath = 'deployment.zip'
) {
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  console.log(`📦 Publishing to Maven Central...`);
  const url = 'https://central.sonatype.com/api/v1/publisher/upload';
  const form = new FormData();
  form.append('bundle', fs.createReadStream(deploymentZipPath));
  let uploadId;
  try {
    const response = await axios_1.default.post(url, form, {
      headers: {
        Authorization: `Basic ${token}`,
        ...form.getHeaders(),
      },
    });
    uploadId = response.data.toString().trim();
    console.log(`✅ Upload ID: ${uploadId}`);
  } catch (err) {
    console.error('🚫 Upload failed:', err.response?.data || err.message);
    process.exit(1);
  }
  let currentStatus = await getUploadStatus(uploadId, token);
  if (['PENDING', 'VALIDATING', 'PUBLISHING'].includes(currentStatus)) {
    currentStatus = await retryUntilValidatedOrPublished(
      currentStatus,
      uploadId,
      token
    );
  }
  if (!['VALIDATED', 'PUBLISHED'].includes(currentStatus)) {
    console.error(`🚫 Upload failed with final status: ${currentStatus}`);
    process.exit(1);
  }
  console.log(`📦 Upload is ${currentStatus}, proceeding to deploy...`);
  if (currentStatus === 'PUBLISHED') {
    console.log('✅ Already published, skipping deployment.');
    return;
  }
  const deployUrl = `https://central.sonatype.com/api/v1/publisher/deployment/${uploadId}`;
  try {
    const deployRes = await axios_1.default.post(deployUrl, null, {
      headers: { Authorization: `Basic ${token}` },
    });
    console.log(`🚀 Deployment response: ${deployRes.data}`);
  } catch (err) {
    console.error('🚫 Deployment failed:', err.response?.data || err.message);
    process.exit(1);
  }
}
async function getUploadStatus(uploadId, token) {
  const url = `https://central.sonatype.com/api/v1/publisher/status?id=${uploadId}`;
  try {
    const response = await axios_1.default.post(url, null, {
      headers: { Authorization: `Basic ${token}` },
    });
    const state = response.data.deploymentState;
    console.log(`📡 Current deployment state: ${state}`);
    return state;
  } catch (err) {
    console.error(
      '🚫 Failed to get status:',
      err.response?.data || err.message
    );
    return 'FAILED';
  }
}
async function retryUntilValidatedOrPublished(
  currentStatus,
  uploadId,
  token,
  retries = 10,
  delay = 10_000
) {
  for (let i = 0; i < retries; i++) {
    console.log(`🔁 Checking status (attempt ${i + 1}/${retries})...`);
    await sleep(delay);
    currentStatus = await getUploadStatus(uploadId, token);
    if (['VALIDATED', 'PUBLISHED', 'FAILED'].includes(currentStatus)) break;
  }
  return currentStatus;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// Entry
(async function main() {
  let { username, password, deploymentZipPath } = parseArgs();
  username = username || process.env.MAVEN_USERNAME;
  password = password || process.env.MAVEN_PASSWORD;
  if (!username || !password) {
    console.error('❌ Missing MAVEN_USERNAME or MAVEN_PASSWORD');
    process.exit(1);
  }
  if (!deploymentZipPath) {
    console.error('❌ Missing required --deploymentZipPath argument');
    process.exit(1);
  }
  await publishToMavenApi(username, password, deploymentZipPath);
})();
