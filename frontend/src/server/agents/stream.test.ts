import { describe, expect, it } from 'vitest';
import { encodeAgentEventStream } from './stream';

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return output;
    output += decoder.decode(value, { stream: true });
  }
}

describe('encodeAgentEventStream', () => {
  it('sends text, safe tool metadata, and completion events without raw tool output', async () => {
    const result = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'run_item_stream_event', name: 'tool_called', item: {
          rawItem: { name: 'search_product_knowledge', callId: 'call-1', arguments: '{"query":"产品冷启动策略"}' },
        } };
        yield { type: 'run_item_stream_event', name: 'tool_output', item: {
          rawItem: { name: 'search_product_knowledge', callId: 'call-1' },
          output: '来源 1：core_principles.md\n不应发送给客户端的长篇检索内容',
        } };
        yield { type: 'raw_model_stream_event', data: { type: 'output_text_delta', delta: '这是回答。' } };
      },
    } as any;

    const output = await readStream(encodeAgentEventStream(result, 'OpenAI'));

    expect(output).toContain('"type":"text","delta":"这是回答。"');
    expect(output).toContain('"label":"检索产品知识库"');
    expect(output).toContain('core_principles.md');
    expect(output).not.toContain('不应发送给客户端的长篇检索内容');
    expect(output).toContain('"type":"done"');
  });

  it('emits a user-confirmable sandbox proposal instead of treating it as a command result', async () => {
    const result = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'run_item_stream_event', name: 'tool_output', item: {
          rawItem: { name: 'propose_sandbox_tool', callId: 'proposal-1' },
          output: { type: 'sandbox_proposal', proposal: { id: 'tool-a', kind: 'cli', label: 'Tool A' } },
        } };
      },
    } as any;

    const output = await readStream(encodeAgentEventStream(result, 'OpenAI'));
    expect(output).toContain('"type":"sandbox_proposal"');
    expect(output).toContain('"id":"tool-a"');
    expect(output).not.toContain('工具执行完成');
  });
});
