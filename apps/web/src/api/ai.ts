import {
  AiTaskSchema,
  ResumeDetailSchema,
  createApiSuccessSchema,
  type AiTask,
  type CreateAiTaskRequest,
  type DecideAiSuggestionRequest,
  type ResumeDetail,
} from '@aceresume/contracts';
import { http } from './http';

const taskResponse = createApiSuccessSchema(AiTaskSchema);
const resumeResponse = createApiSuccessSchema(ResumeDetailSchema);

export async function createTask(input: CreateAiTaskRequest): Promise<AiTask> {
  return taskResponse.parse((await http.post('/ai/tasks', input)).data).data;
}
export async function getTask(id: string): Promise<AiTask> {
  return taskResponse.parse((await http.get('/ai/tasks/' + id)).data).data;
}
export async function acceptSuggestion(
  taskId: string,
  suggestionId: string,
  input: DecideAiSuggestionRequest,
): Promise<ResumeDetail> {
  return resumeResponse.parse(
    (await http.post('/ai/tasks/' + taskId + '/generations/' + suggestionId + '/accept', input))
      .data,
  ).data;
}
export async function rejectSuggestion(taskId: string, suggestionId: string): Promise<AiTask> {
  return taskResponse.parse(
    (await http.post('/ai/tasks/' + taskId + '/generations/' + suggestionId + '/reject')).data,
  ).data;
}
