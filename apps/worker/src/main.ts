import { Worker } from 'bullmq';
import { WorkerEnvironmentSchema, loadEnvironment } from '@aceresume/config';

const environment = loadEnvironment(WorkerEnvironmentSchema, process.env);
const worker = new Worker(
  'system',
  async (job) => {
    process.stdout.write(
      JSON.stringify({ level: 'log', jobId: job.id, event: 'system.job.received' }) + '\n',
    );
  },
  {
    connection: { url: environment.REDIS_URL },
    concurrency: environment.WORKER_CONCURRENCY,
  },
);

worker.on('error', (error: Error) => {
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'system.worker.error', message: error.message }) + '\n',
  );
});

async function shutdown(): Promise<void> {
  await worker.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
