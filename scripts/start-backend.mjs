import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
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

// 读取并校验 API_PORT 配置。
const envContent = readFileSync(envPath, 'utf-8');
const apiPortMatch = envContent.match(/^API_PORT=(\d+)$/m);
if (!apiPortMatch) {
  console.error('.env 中缺少有效的 API_PORT 配置。');
  process.exit(1);
}
const apiPort = Number.parseInt(apiPortMatch[1], 10);

// 检测端口是否被占用（跨平台实现，替代 Get-NetTCPConnection）。
function isPortInUse(port) {
  return new Promise((resolvePort) => {
    const socket = createConnection({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolvePort(true);
    });
    socket.on('error', () => resolvePort(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolvePort(false);
    });
  });
}

if (await isPortInUse(apiPort)) {
  console.error(
    `API_PORT=${apiPort} 已被其他程序占用。请在 .env 中选择空闲端口，并同步修改 VITE_API_BASE_URL。`,
  );
  process.exit(1);
}

// 启动本地基础设施（PostgreSQL、Redis、MinIO 等）。
console.log('启动 Docker 基础设施...');
const infra = spawnSync('docker', ['compose', 'up', '-d'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
});
if (infra.status !== 0) {
  process.exit(infra.status ?? 1);
}

// 在后台启动 Worker，API 退出时自动清理。
console.log('启动 Worker 后台进程...');
const worker = spawn('corepack', ['pnpm', 'dev:worker'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  windowsHide: true,
});

console.log(`Worker 已在后台启动（PID: ${worker.pid}）。`);

function cleanupWorker() {
  if (worker.exitCode === null) {
    try {
      if (process.platform === 'win32') {
        // Windows 下通过 taskkill 终止整个进程树。
        spawnSync('taskkill', ['/PID', String(worker.pid), '/T', '/F'], {
          stdio: 'ignore',
          shell: true,
        });
      } else {
        worker.kill('SIGTERM');
      }
    } catch {
      // 忽略清理错误。
    }
  }
}

process.on('exit', cleanupWorker);
process.on('SIGINT', () => {
  cleanupWorker();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanupWorker();
  process.exit(143);
});

// 启动主 API 进程（前台），退出时连带关闭 Worker。
console.log('启动 API 服务...');
const api = spawn('corepack', ['pnpm', 'dev:api'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
});

api.on('error', (error) => {
  console.error(`API 进程启动失败: ${error.message}`);
  cleanupWorker();
  process.exit(1);
});

api.on('exit', (code) => {
  cleanupWorker();
  process.exit(code ?? 1);
});
