import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(projectRoot, '.env');
const envExamplePath = resolve(projectRoot, '.env.example');

// 如果 .env 不存在，从 .env.example 创建本地 .env。
if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  console.log('已从 .env.example 创建本地 .env。');
}

// 启动前端 Vite dev 服务器（前台）。
const result = spawnSync('corepack', ['pnpm', 'dev:web'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
