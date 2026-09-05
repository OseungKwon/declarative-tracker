#!/usr/bin/env node
// PR이 main으로 들어가기 전에 릴리스 규칙을 검사한다.
//   1. src/ 를 바꿨으면 .changeset/*.md 가 함께 있어야 한다
//   2. package.json 버전을 바꿨으면 base 버전에서 정확히 한 단계(patch/minor/major)여야 한다
// 사용: node scripts/check-release.js [base-ref]   (기본 origin/main)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'origin/main';

/** git 명령을 실행해 stdout을 돌려준다. */
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** "x.y.z" 를 숫자 배열로 바꾼다. 형식이 다르면 null. */
function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

/** from 에서 한 단계 올린 버전 세 개를 돌려준다. */
function nextVersions([major, minor, patch]) {
  return {
    patch: `${major}.${minor}.${patch + 1}`,
    minor: `${major}.${minor + 1}.0`,
    major: `${major + 1}.0.0`,
  };
}

const changes = git('diff', '--name-status', `${base}...HEAD`)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [status, ...paths] = line.split('\t');
    return { status: status[0], path: paths[paths.length - 1] };
  });

const srcChanged = changes.some(({ path }) => path.startsWith('src/'));
const changesetAdded = changes.some(
  ({ status, path }) =>
    (status === 'A' || status === 'M') && /^\.changeset\/(?!README\.md$).+\.md$/.test(path),
);

const baseVersion = JSON.parse(git('show', `${base}:package.json`)).version;
const headVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;

const errors = [];

if (srcChanged && !changesetAdded) {
  errors.push(
    'src/ changed but no changeset was added. Run `pnpm changeset` and commit the generated file.',
  );
}

if (headVersion !== baseVersion) {
  const parsed = parseVersion(baseVersion);
  const allowed = parsed ? Object.values(nextVersions(parsed)) : [];
  if (!allowed.includes(headVersion)) {
    errors.push(
      `package.json version ${baseVersion} -> ${headVersion} is not a single step. ` +
        `Allowed: ${allowed.join(', ') || '(base version is not x.y.z)'}.`,
    );
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`);
  process.exit(1);
}

console.log(
  `✓ release check passed (src changed: ${srcChanged}, changeset: ${changesetAdded}, version: ${baseVersion} -> ${headVersion})`,
);
