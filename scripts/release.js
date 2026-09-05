#!/usr/bin/env node
// package.json 버전이 npm에 없으면 publish하고 changeset 태그를 만든다. 이미 있으면 아무것도 하지 않는다.
// changeset publish 대신 쓰는 이유: pnpm 워크스페이스에서는 changesets가 pnpm publish를 호출하는데,
// pnpm publish는 npm trusted publishing(OIDC)을 지원하지 않는다. npm CLI로 직접 올린다.
// RELEASE_DRY_RUN=1 이면 npm publish --dry-run 만 하고 태그는 만들지 않는다.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
const dryRun = process.env.RELEASE_DRY_RUN === '1';

/** 명령을 실행하고 실패하면 같은 코드로 종료한다. */
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const published = spawnSync('npm', ['view', `${name}@${version}`, 'version'], {
  encoding: 'utf8',
}).stdout.trim();

if (published === version) {
  console.log(`${name}@${version} is already on npm; nothing to publish`);
  process.exit(0);
}

console.log(`publishing ${name}@${version}${dryRun ? ' (dry run)' : ''}`);
run('npm', ['publish', '--provenance', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])]);
if (!dryRun) run('pnpm', ['changeset', 'tag']);
