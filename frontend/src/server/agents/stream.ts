import type { RunStreamEvent, StreamedRunResult } from '@openai/agents';

/** Maintains the legacy plain-text stream used by non-chat routes. */
export function encodeTextStream(source: AsyncIterable<string>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const value of source) {
          if (value) controller.enqueue(encoder.encode(value));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

type ChatStreamEvent =
  | { type: 'meta'; provider: string }
  | { type: 'text'; delta: string }
  | { type: 'step'; id: string; kind: 'reasoning' | 'tool'; label: string; status: 'running' | 'completed'; detail?: string }
  | { type: 'sandbox_proposal'; proposal: Record<string, unknown> }
  | { type: 'done' };

function toSse(event: ChatStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function shortQuery(argumentsText: unknown) {
  if (typeof argumentsText !== 'string') return undefined;
  try {
    const parsed = JSON.parse(argumentsText) as { query?: unknown };
    return typeof parsed.query === 'string' ? parsed.query.slice(0, 160) : undefined;
  } catch {
    return undefined;
  }
}

function toolLabel(name: string) {
  if (name === 'search_product_knowledge' || name.includes('file_search')) return '检索产品知识库';
  if (name === 'search_web') return '联网搜索公开来源';
  if (name === 'propose_sandbox_tool') return '生成云端工具安装提案';
  return `调用工具：${name}`;
}

function toolDetail(name: string, output: unknown) {
  if (name === 'search_web') {
    const text = typeof output === 'string' ? output : JSON.stringify(output ?? '');
    const sources = Array.from(text.matchAll(/来源\s*\d*[：:]\s*(https?:\/\/\S+)/g))
      .map((match) => match[1].replace(/[),。]+$/u, ''))
      .slice(0, 3);
    return sources.length ? `已检索：${sources.join('、')}` : '已完成联网搜索';
  }
  if (name !== 'search_product_knowledge' && !name.includes('file_search')) return '工具执行完成';
  const text = typeof output === 'string' ? output : JSON.stringify(output ?? '');
  const sources = Array.from(text.matchAll(/(?:来源\s*\d*[：:]\s*|\[)([^\]\n：:]{1,120})/g))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 3);
  return sources.length ? `已找到：${sources.join('、')}` : '已完成知识库检索';
}

function sandboxProposal(output: unknown) {
  if (typeof output === 'string') {
    try {
      return sandboxProposal(JSON.parse(output));
    } catch {
      return undefined;
    }
  }
  if (!output || typeof output !== 'object') return undefined;
  const record = output as Record<string, unknown>;
  return record.type === 'sandbox_proposal' && record.proposal && typeof record.proposal === 'object'
    ? record.proposal as Record<string, unknown>
    : undefined;
}

function processRunEvent(event: RunStreamEvent): ChatStreamEvent[] {
  if (event.type === 'raw_model_stream_event' && event.data.type === 'output_text_delta') {
    return [{ type: 'text', delta: event.data.delta }];
  }

  if (event.type !== 'run_item_stream_event') return [];
  if (event.name === 'reasoning_item_created') {
    return [{
      type: 'step',
      id: 'reasoning:analysis',
      kind: 'reasoning',
      label: '评估关键信息与回答策略',
      status: 'completed',
    }];
  }

  const rawItem = asRecord(event.item.rawItem);
  if (event.name === 'tool_called') {
    const name = typeof rawItem?.name === 'string' ? rawItem.name : '工具';
    const callId = typeof rawItem?.callId === 'string' ? rawItem.callId : name;
    const query = shortQuery(rawItem?.arguments);
    return [{
      type: 'step',
      id: `tool:${callId}`,
      kind: 'tool',
      label: toolLabel(name),
      status: 'running',
      detail: query ? `查询：${query}` : undefined,
    }];
  }

  if (event.name === 'tool_output') {
    const name = typeof rawItem?.name === 'string' ? rawItem.name : '工具';
    const callId = typeof rawItem?.callId === 'string' ? rawItem.callId : name;
    const output = 'output' in event.item ? event.item.output : undefined;
    const proposal = name === 'propose_sandbox_tool' ? sandboxProposal(output) : undefined;
    if (proposal) return [{ type: 'sandbox_proposal', proposal }];
    return [{
      type: 'step',
      id: `tool:${callId}`,
      kind: 'tool',
      label: toolLabel(name),
      status: 'completed',
      detail: toolDetail(name, output),
    }];
  }

  return [];
}

/**
 * Emits a safe, user-facing execution timeline. This deliberately does not
 * expose private model reasoning or raw tool payloads.
 */
export function encodeAgentEventStream(result: StreamedRunResult<any, any>, provider: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => controller.enqueue(encoder.encode(toSse(event)));
      try {
        send({ type: 'meta', provider });
        send({ type: 'step', id: 'reasoning:understand', kind: 'reasoning', label: '理解问题并梳理约束', status: 'running' });
        for await (const event of result) {
          for (const update of processRunEvent(event)) send(update);
        }
        send({ type: 'step', id: 'reasoning:understand', kind: 'reasoning', label: '理解问题并梳理约束', status: 'completed' });
        send({ type: 'step', id: 'reasoning:answer', kind: 'reasoning', label: '组织成可执行的建议', status: 'completed' });
        send({ type: 'done' });
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
