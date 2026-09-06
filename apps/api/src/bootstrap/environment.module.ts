import { Global, Module } from '@nestjs/common';
import { ApiEnvironmentSchema, loadEnvironment } from '@aceresume/config';

export const API_ENVIRONMENT = Symbol('API_ENVIRONMENT');

@Global()
@Module({
  providers: [
    {
      provide: API_ENVIRONMENT,
      useFactory: () => loadEnvironment(ApiEnvironmentSchema, process.env),
    },
  ],
  exports: [API_ENVIRONMENT],
})
export class EnvironmentModule {}
