#!/usr/bin/env node
// package.json 버전이 npm에 없으면 publish하고 v{version} 태그와 GitHub Release를 만든다. 이미 있으면 아무것도 하지 않는다.
// changeset publish 대신 쓰는 이유: pnpm 워크스페이스에서는 changesets가 pnpm publish를 호출하는데,
// pnpm publish는 npm trusted publishing(OIDC)을 지원하지 않는다. npm CLI로 직접 올린다.
// RELEASE_DRY_RUN=1 이면 npm publish --dry-run 만 하고 태그·릴리스는 만들지 않는다.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
const dryRun = process.env.RELEASE_DRY_RUN === '1';
const tag = `v${version}`;

/** 명령을 실행하고 실패하면 같은 코드로 종료한다. */
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** 명령의 stdout을 돌려준다. 실패하면 빈 문자열. */
function output(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' }).stdout?.trim() ?? '';
}

/** CHANGELOG.md에서 이 버전의 절만 잘라 낸다. 없으면 빈 문자열. */
function changelogSection() {
  let changelog = '';
  try {
    changelog = readFileSync('CHANGELOG.md', 'utf8');
  } catch {
    return '';
  }
  const match = new RegExp(
    `^## ${version.replace(/\./g, '\\.')}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\r\\n]))`,
    'm',
  ).exec(changelog);
  return match?.[1]?.trim() ?? '';
}

if (output('npm', ['view', `${name}@${version}`, 'version']) === version) {
  console.log(`${name}@${version} is already on npm; nothing to publish`);
  process.exit(0);
}

console.log(`publishing ${name}@${version}${dryRun ? ' (dry run)' : ''}`);
run('npm', ['publish', '--provenance', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])]);
if (dryRun) process.exit(0);

if (output('git', ['tag', '--list', tag]) !== tag) {
  run('git', ['tag', tag]);
  run('git', ['push', 'origin', tag]);
}
if (output('gh', ['release', 'view', tag, '--json', 'tagName', '--jq', '.tagName']) !== tag) {
  const notes = changelogSection() || `${name}@${version}`;
  run('gh', ['release', 'create', tag, '--title', tag, '--notes', notes]);
}
