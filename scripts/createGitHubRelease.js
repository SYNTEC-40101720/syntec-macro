// Helper script: creates a GitHub Release using the API.
// Usage: node scripts/createGitHubRelease.js <tag> <token>
// If token is omitted, reads from GH_TOKEN env or GITHUB_TOKEN env.

const https = require('https');
const { execSync } = require('child_process');

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: node scripts/createGitHubRelease.js <tag> [token]');
  process.exit(1);
}

const token = process.argv[3] || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error('No GitHub token found. Set GH_TOKEN or GITHUB_TOKEN env var.');
  process.exit(1);
}

const repo = 'SYNTEC-40101720/syntec-macro';

const body = `# v${tag.slice(1)} - 2026-07-25

## Fixed
- **格式化器安全性**: 修复跨行块注释被误改、多个规范化操作发生位置偏移，以及同行体导致后续代码错误缩排的问题。
- **格式化器规范化**: 自动补全需要的结尾分号，删除控制结构头多余分号，并将兼容写法和赋值运算符转为推荐写法。
- **格式化器边界**: 同行控制体、CASE 标签后赋值、行尾注释和字符串内容均得到保护。`;

const data = JSON.stringify({
  tag_name: tag,
  name: tag,
  body: body,
  draft: false,
  prerelease: false
});

const options = {
  hostname: 'api.github.com',
  path: `/repos/${repo}/releases`,
  method: 'POST',
  headers: {
    'Authorization': `token ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'syntec-macro-release-script'
  }
};

const req = https.request(options, (res) => {
  let responseBody = '';
  res.on('data', (chunk) => responseBody += chunk);
  res.on('end', () => {
    if (res.statusCode === 201) {
      const parsed = JSON.parse(responseBody);
      console.log(`✅ Release created: ${parsed.html_url}`);
    } else {
      console.error(`❌ Error ${res.statusCode}: ${responseBody}`);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message);
  process.exit(1);
});

req.write(data);
req.end();
