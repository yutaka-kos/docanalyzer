import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function streamMessage(systemPrompt: string, userMessage: string) {
  return client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
}

export async function createMessage(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

export async function streamChat(
  systemPrompt: string,
  messages: { role: string; content: string }[]
) {
  return client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages as any,
  });
}
