'use strict';

// Package the app for cPanel deployment: dist/eph-service-<version>.zip
// Contains source + package.json + package-lock.json only. No node_modules (swisseph must be
// compiled on the host via "Run NPM Install") and no clients.json (upload secrets separately).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const NAME = `${pkg.name}-${pkg.version}`;
const STAGE = path.join(DIST, NAME);
const ZIP = path.join(DIST, `${NAME}.zip`);

const INCLUDE = ['src', 'package.json', 'clients.example.json'];

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

// 1. Sanity check the local build before packaging
run(process.execPath, [path.join(ROOT, 'src/check.js')], ROOT);

// 2. Fresh staging folder
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
for (const item of INCLUDE) {
  fs.cpSync(path.join(ROOT, item), path.join(STAGE, item), { recursive: true });
}

// 3. Drop the node-gyp override: it's only for local Python 3.12+ (no distutils). The host has
//    Python 3.6, which newer node-gyp can't run, so it must use swisseph's own node-gyp 8.4.1.
const stagedPkgPath = path.join(STAGE, 'package.json');
const stagedPkg = JSON.parse(fs.readFileSync(stagedPkgPath, 'utf8'));
delete stagedPkg.overrides;
fs.writeFileSync(stagedPkgPath, JSON.stringify(stagedPkg, null, 2) + '\n');

// 4. package-lock.json so cPanel's npm installs pinned versions
run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], STAGE);

// 5. Zip it (contents at zip root, so it extracts straight into the app folder)
run('zip', ['-rq', ZIP, '.', '-x', '.DS_Store', '*/.DS_Store'], STAGE);

const sizeKb = Math.round(fs.statSync(ZIP).size / 1024);
console.log(`\nBuilt ${path.relative(ROOT, ZIP)} (${sizeKb} KB)`);
