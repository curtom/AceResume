import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ApiEnvironmentSchema, loadEnvironment } from '@aceresume/config';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import { RequestIdInterceptor } from './common/request-id.interceptor.js';
import { StructuredLogger } from './common/structured-logger.js';

async function bootstrap(): Promise<void> {
  const environment = loadEnvironment(ApiEnvironmentSchema, process.env);
  const logger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, { logger });
  if (environment.NODE_ENV === 'development')
    app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
  app.enableCors({ origin: environment.WEB_ORIGIN, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('AceResume API').setVersion('v1').build(),
  );
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(environment.API_PORT, environment.API_HOST);
}

void bootstrap();
