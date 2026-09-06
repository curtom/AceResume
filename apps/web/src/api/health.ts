import { type HealthData, HealthDataSchema, createApiSuccessSchema } from '@aceresume/contracts';
import { http } from './http';

export async function getHealth(): Promise<HealthData> {
  const response = await http.get<unknown>('/health');
  return createApiSuccessSchema(HealthDataSchema).parse(response.data).data;
}
