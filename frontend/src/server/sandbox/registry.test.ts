import { afterEach, describe, expect, it } from 'vitest';
import { getSandboxPackages, getSandboxRegistry, listSandboxTools } from './registry';

const originalRegistry = process.env.SANDBOX_TOOL_REGISTRY;

afterEach(() => {
  if (originalRegistry === undefined) delete process.env.SANDBOX_TOOL_REGISTRY;
  else process.env.SANDBOX_TOOL_REGISTRY = originalRegistry;
});

describe('sandbox tool registry', () => {
  it('exposes only safe display metadata and keeps package declarations server-side', () => {
    process.env.SANDBOX_TOOL_REGISTRY = JSON.stringify({
      tools: [{
        id: 'tool-a', label: 'Tool A', description: 'A safe tool', kind: 'cli',
        command: 'tool-a', args: ['--json'], input: 'json-file', network: [], timeoutMs: 3_000,
        install: ['tool-a@1.0.0'],
      }],
    });

    expect(getSandboxRegistry()[0]).toMatchObject({ command: 'tool-a', args: ['--json'] });
    expect(listSandboxTools()).toEqual([{ id: 'tool-a', label: 'Tool A', description: 'A safe tool', kind: 'cli' }]);
    expect(getSandboxPackages()).toEqual(['tool-a@1.0.0']);
  });

  it('rejects duplicate IDs and unsafe command paths', () => {
    process.env.SANDBOX_TOOL_REGISTRY = JSON.stringify({
      tools: [
        { id: 'same', label: 'A', description: 'A', kind: 'cli', command: '../bin/sh' },
        { id: 'same', label: 'B', description: 'B', kind: 'cli', command: 'safe-command' },
      ],
    });

    expect(() => getSandboxRegistry()).toThrow('Invalid SANDBOX_TOOL_REGISTRY');
  });
});
