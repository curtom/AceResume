export interface ChatModelAdapter {
  generate(input: { prompt: string }): Promise<unknown>;
}
