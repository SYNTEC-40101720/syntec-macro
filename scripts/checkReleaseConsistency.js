const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseReleaseTag(tag) {
  if (tag === undefined) return null;
  const match = tag.match(/^v(\d+\.\d+\.\d+)$/);
  return match ? match[1] : null;
}

function checkReleaseConsistency(input) {
  const errors = [];
  const packageVersion = input.packageJson.version;
  const lockVersion = input.packageLock.version;
  const lockRootVersion = input.packageLock.packages && input.packageLock.packages['']
    ? input.packageLock.packages[''].version
    : undefined;

  if (!/^\d+\.\d+\.\d+$/.test(packageVersion || '')) {
    errors.push(`package.json version ${packageVersion || '(missing)'} must match X.Y.Z.`);
  }
  if (lockVersion !== packageVersion) {
    errors.push(`package-lock.json version ${lockVersion || '(missing)'} does not match package.json ${packageVersion}.`);
  }
  if (lockRootVersion !== packageVersion) {
    errors.push(`package-lock.json root package version ${lockRootVersion || '(missing)'} does not match package.json ${packageVersion}.`);
  }

  if (input.releaseTag === undefined) return errors;
  const releaseVersion = parseReleaseTag(input.releaseTag);
  if (!releaseVersion) {
    errors.push(`Release tag ${input.releaseTag} must match vX.Y.Z.`);
    return errors;
  }

  if (releaseVersion !== packageVersion) {
    errors.push(`Release tag ${input.releaseTag} does not match package.json ${packageVersion}.`);
  }

  const badgeMatch = input.readme.match(/version-(\d+\.\d+\.\d+)-/);
  const badgeVersion = badgeMatch ? badgeMatch[1] : undefined;
  if (badgeVersion !== releaseVersion) {
    errors.push(`README version badge ${badgeVersion || '(missing)'} does not match release ${releaseVersion}.`);
  }

  const escapedVersion = releaseVersion.replace(/\./g, '\\.');
  const changelogHeading = new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm');
  if (!changelogHeading.test(input.changelog)) {
    errors.push(`CHANGELOG release section [${releaseVersion}] with a date was not found.`);
  }

  return errors;
}

function getArgumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(args = process.argv.slice(2)) {
  const releaseTag = args.includes('--tag') ? (getArgumentValue(args, '--tag') || '') : undefined;
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const errors = checkReleaseConsistency({ packageJson, packageLock, readme, changelog, releaseTag });

  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.info(releaseTag
    ? `Release metadata is consistent for ${releaseTag}.`
    : `Package metadata is consistent for ${packageJson.version}.`);
}

if (require.main === module) main();

module.exports = { checkReleaseConsistency, parseReleaseTag };