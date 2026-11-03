import {spawnSync} from 'node:child_process';

const worker = new URL(
  '../backend/src/workers/prospecting-verified-delivery.mjs',
  import.meta.url
).pathname;

const result = spawnSync('/usr/bin/flock', [
  '-n',
  '/run/lock/digitale-verified-delivery.lock',
  process.execPath,
  worker
], {stdio:'inherit', env:process.env});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
