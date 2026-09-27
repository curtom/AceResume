import { ModelSuggestionOutputSchema, QwenEmbeddingProvider, QwenProvider } from '../src/index.js';

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured.');

const options = {
  baseUrl: process.env.AI_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey,
  timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30_000),
};
const chatModel = process.env.AI_CHAT_MODEL ?? 'qwen3.7-plus';
const embeddingModel = process.env.AI_EMBEDDING_MODEL ?? 'qwen3.7-text-embedding';
const dimension = Number(process.env.AI_EMBEDDING_DIMENSION ?? 1024);

const chat = new QwenProvider(chatModel, options);
const result = await chat.generateStructured({
  schemaName: 'resume_suggestions',
  schema: ModelSuggestionOutputSchema,
  systemPrompt:
    '你是结构化简历助手。只能输出 JSON 对象，格式为 suggestions 数组；每项只包含 text 和 citationIds。只能使用事实材料，citationIds 必须为 source-1。',
  userPrompt: '将事实材料改写成一句简洁的简历描述。',
  contexts: [
    {
      id: 'source-1',
      label: '脱敏验证材料',
      text: '使用 Vue 3 与 TypeScript 完成课程项目。',
    },
  ],
});

const embedding = new QwenEmbeddingProvider(embeddingModel, dimension, options);
const vectors = await embedding.embed(['AceResume 真实模型连通性验证']);

process.stdout.write(
  JSON.stringify({
    chat: 'ok',
    chatModel,
    suggestionCount: result.suggestions.length,
    citationIds: result.suggestions[0]?.citationIds ?? [],
    embedding: 'ok',
    embeddingModel,
    vectorDimension: vectors[0]?.length ?? 0,
  }) + '\n',
);
