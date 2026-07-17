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

const body = `# v${tag.slice(1)} - 2026-07-17

## Fixed
- **控制结构同行体误报**: \`IF ... THEN <stmt>; ELSE <stmt>; END_IF;\` 等同行体写法虽不推荐但控制器实际支援，不再误报"控制结构行不应以 ; 结尾"。覆盖 IF/ELSEIF/WHILE/FOR/REPEAT/CASE 所有控制结构。
- **DEFAULT 降级为 warning**: \`DEFAULT:\` 在 CASE 中实际可用，从 error 降级为 style warning "支援但不推荐，建议使用 ELSE"。`;

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
