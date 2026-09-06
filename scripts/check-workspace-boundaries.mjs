import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const workspaceRoot = globalThis.process.cwd();
const packageDirectory = join(workspaceRoot, 'packages');
const applicationNames = new Set(['@aceresume/api', '@aceresume/web', '@aceresume/worker']);
const entries = await readdir(packageDirectory, { withFileTypes: true });
const packageManifests = await Promise.all(
  entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const path = join(packageDirectory, entry.name, 'package.json');
      return JSON.parse(await readFile(path, 'utf8'));
    }),
);

const violations = packageManifests.flatMap((manifest) => {
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };
  return Object.keys(dependencies)
    .filter((name) => applicationNames.has(name))
    .map((name) => `${manifest.name} must not depend on ${name}`);
});

if (violations.length > 0) {
  throw new Error(violations.join('\n'));
}
