import { randomUUID } from 'node:crypto';

// OpenCode Go rejects tool-call history sent to /v1/responses, so the eval
// proxy sends Responses requests to /v1/chat/completions and converts both
// directions. The AI SDK replays earlier output as item_reference entries, so
// the proxy keeps every output item it returns and resolves those references.

export type JsonObject = Record<string, unknown>;

export type ItemStore = Map<string, JsonObject>;

export class TranslationError extends Error {}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: { id: string; type: 'function'; function: JsonObject }[];
  tool_call_id?: string;
  reasoning_content?: string;
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

function remember(items: ItemStore, item: JsonObject): JsonObject {
  items.set(String(item.id), item);
  return item;
}

function textOf(content: unknown, type: string): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) {
    throw new TranslationError(`unsupported message content: ${type}`);
  }
  return content
    .map((part: JsonObject) => {
      if (
        part.type === 'input_text' ||
        part.type === 'output_text' ||
        part.type === 'text'
      ) {
        return String(part.text ?? '');
      }
      throw new TranslationError(
        `unsupported content part in ${type}: ${String(part.type)}`,
      );
    })
    .join('');
}

function resolveReference(item: JsonObject, items: ItemStore): JsonObject {
  if (item.type !== 'item_reference') return item;
  const stored = items.get(String(item.id));
  if (!stored) {
    throw new TranslationError(
      `item_reference ${String(item.id)} is not known to this eval run`,
    );
  }
  return stored;
}

function lastAssistant(messages: ChatMessage[]): ChatMessage | undefined {
  const last = messages.at(-1);
  return last?.role === 'assistant' ? last : undefined;
}

function openAssistant(messages: ChatMessage[]): ChatMessage {
  const last = lastAssistant(messages);
  if (last) return last;
  const created: ChatMessage = { role: 'assistant', content: null };
  messages.push(created);
  return created;
}

function appendItem(messages: ChatMessage[], item: JsonObject): void {
  switch (item.type) {
    case 'reasoning': {
      const summary = Array.isArray(item.summary) ? item.summary : [];
      const text = summary
        .map((part: JsonObject) => String(part.text ?? ''))
        .join('');
      if (text) openAssistant(messages).reasoning_content = text;
      return;
    }
    case 'function_call': {
      const assistant = openAssistant(messages);
      assistant.tool_calls = [
        ...(assistant.tool_calls ?? []),
        {
          id: String(item.call_id),
          type: 'function',
          function: {
            name: String(item.name),
            arguments: String(item.arguments ?? '{}'),
          },
        },
      ];
      return;
    }
    case 'function_call_output': {
      messages.push({
        role: 'tool',
        tool_call_id: String(item.call_id),
        content:
          typeof item.output === 'string'
            ? item.output
            : JSON.stringify(item.output),
      });
      return;
    }
    case undefined:
    case 'message': {
      const role = item.role === 'developer' ? 'system' : item.role;
      if (role !== 'user' && role !== 'system' && role !== 'assistant') {
        throw new TranslationError(`unsupported message role: ${String(role)}`);
      }
      const text = textOf(item.content, `${role} message`);
      if (role === 'assistant') {
        const assistant = openAssistant(messages);
        assistant.content = `${assistant.content ?? ''}${text}`;
        return;
      }
      messages.push({ role, content: text });
      return;
    }
    default:
      throw new TranslationError(
        `unsupported input item type: ${String(item.type)}`,
      );
  }
}

function convertTool(tool: JsonObject): JsonObject {
  if (tool.type !== 'function') {
    throw new TranslationError(`unsupported tool type: ${String(tool.type)}`);
  }
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      ...(tool.strict !== undefined && { strict: tool.strict }),
    },
  };
}

function convertToolChoice(choice: unknown): unknown {
  if (
    choice &&
    typeof choice === 'object' &&
    (choice as JsonObject).type === 'function'
  ) {
    return {
      type: 'function',
      function: { name: (choice as JsonObject).name },
    };
  }
  return choice;
}

export function responsesToChat(
  body: JsonObject,
  items: ItemStore,
): JsonObject {
  if (body.stream === true) {
    throw new TranslationError('streaming is not supported by the eval proxy');
  }
  if (body.previous_response_id) {
    throw new TranslationError(
      'previous_response_id is not supported by the eval proxy',
    );
  }

  const messages: ChatMessage[] = [];
  if (typeof body.instructions === 'string' && body.instructions) {
    messages.push({ role: 'system', content: body.instructions });
  }

  let input: unknown[];
  if (typeof body.input === 'string') {
    input = [{ type: 'message', role: 'user', content: body.input }];
  } else if (Array.isArray(body.input)) {
    input = body.input;
  } else {
    throw new TranslationError('input must be a string or an array');
  }
  for (const raw of input) {
    appendItem(messages, resolveReference(raw as JsonObject, items));
  }

  const chat: JsonObject = { model: body.model, messages };
  if (Array.isArray(body.tools)) {
    chat.tools = body.tools.map((tool) => convertTool(tool as JsonObject));
  }
  if (body.tool_choice !== undefined) {
    chat.tool_choice = convertToolChoice(body.tool_choice);
  }
  for (const key of ['temperature', 'top_p'] as const) {
    if (body[key] !== undefined) chat[key] = body[key];
  }
  if (typeof body.max_output_tokens === 'number') {
    chat.max_tokens = body.max_output_tokens;
  }
  return chat;
}

export function chatToResponses(
  chat: JsonObject,
  items: ItemStore,
): JsonObject {
  const choices = Array.isArray(chat.choices) ? chat.choices : [];
  const choice = (choices[0] ?? {}) as JsonObject;
  const message = (choice.message ?? {}) as JsonObject;
  const output: JsonObject[] = [];

  if (
    typeof message.reasoning_content === 'string' &&
    message.reasoning_content
  ) {
    output.push(
      remember(items, {
        type: 'reasoning',
        id: newId('rs'),
        summary: [{ type: 'summary_text', text: message.reasoning_content }],
      }),
    );
  }
  if (typeof message.content === 'string' && message.content) {
    output.push(
      remember(items, {
        type: 'message',
        id: newId('msg'),
        role: 'assistant',
        status: 'completed',
        content: [
          { type: 'output_text', text: message.content, annotations: [] },
        ],
      }),
    );
  }
  for (const call of (message.tool_calls ?? []) as JsonObject[]) {
    const fn = call.function as JsonObject;
    output.push(
      remember(items, {
        type: 'function_call',
        id: newId('fc'),
        call_id: call.id,
        name: fn.name,
        arguments: fn.arguments,
        status: 'completed',
      }),
    );
  }

  const usage = (chat.usage ?? {}) as JsonObject;
  const truncated = choice.finish_reason === 'length';
  return {
    id: newId('resp'),
    object: 'response',
    created_at: typeof chat.created === 'number' ? chat.created : 0,
    status: truncated ? 'incomplete' : 'completed',
    error: null,
    incomplete_details: truncated ? { reason: 'max_output_tokens' } : null,
    model: chat.model,
    output,
    usage: {
      input_tokens: Number(usage.prompt_tokens ?? 0),
      output_tokens: Number(usage.completion_tokens ?? 0),
      total_tokens: Number(usage.total_tokens ?? 0),
    },
  };
}
