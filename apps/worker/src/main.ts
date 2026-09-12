import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { WorkerEnvironmentSchema, loadEnvironment } from '@aceresume/config';
import { EmailJobSchema } from '@aceresume/contracts';

const environment = loadEnvironment(WorkerEnvironmentSchema, process.env);
const systemWorker = new Worker(
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

systemWorker.on('error', (error: Error) => {
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'system.worker.error', message: error.message }) + '\n',
  );
});

const mailTransport = nodemailer.createTransport({
  host: environment.MAIL_HOST,
  port: environment.MAIL_PORT,
  secure: false,
});
const emailWorker = new Worker(
  'email.send',
  async (job) => {
    const message = EmailJobSchema.parse(job.data);
    await mailTransport.sendMail({ from: environment.MAIL_FROM, ...message });
    process.stdout.write(
      JSON.stringify({ level: 'log', jobId: job.id, event: 'email.sent' }) + '\n',
    );
  },
  { connection: { url: environment.REDIS_URL }, concurrency: environment.WORKER_CONCURRENCY },
);
emailWorker.on('error', (error: Error) => {
  process.stderr.write(
    JSON.stringify({ level: 'error', event: 'email.worker.error', message: error.name }) + '\n',
  );
});

async function shutdown(): Promise<void> {
  await Promise.all([systemWorker.close(), emailWorker.close()]);
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
