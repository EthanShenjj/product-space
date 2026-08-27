import { z } from 'zod';

const toolIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/);
const packageSchema = z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[a-z0-9][a-z0-9._+:-]*)?$/i);
const domainSchema = z.string().regex(/^(?:\*\.)?[a-z0-9][a-z0-9.-]*[a-z0-9]$/i);
const blockedExecutables = new Set(['sh', 'bash', 'zsh', 'fish', 'cmd', 'powershell', 'pwsh', 'node', 'nodejs', 'python', 'python3']);

export const sandboxToolSchema = z.object({
  id: toolIdSchema,
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  kind: z.enum(['cli', 'mcp', 'skill']),
  command: z.string().regex(/^[a-zA-Z0-9._/-]+$/)
    .refine((value) => !value.includes('..'), 'command cannot traverse paths')
    .refine((value) => !blockedExecutables.has(value.split('/').at(-1)?.toLowerCase() || ''), 'shell and runtime executables are not allowed'),
  args: z.array(z.string().max(512)).max(32).default([]),
  input: z.enum(['none', 'json-file']).default('json-file'),
  network: z.array(domainSchema).max(20).default([]),
  timeoutMs: z.number().int().min(1_000).max(50_000).default(30_000),
  install: z.array(packageSchema).max(30).default([]),
});

const registrySchema = z.object({
  tools: z.array(sandboxToolSchema).max(50),
}).superRefine((registry, ctx) => {
  const ids = new Set<string>();
  registry.tools.forEach((tool, index) => {
    if (ids.has(tool.id)) {
      ctx.addIssue({ code: 'custom', path: ['tools', index, 'id'], message: 'tool id must be unique' });
    }
    ids.add(tool.id);
  });
});

export type SandboxTool = z.infer<typeof sandboxToolSchema>;
export type PublicSandboxTool = Pick<SandboxTool, 'id' | 'label' | 'description' | 'kind'>;

/**
 * Reads a server-only allowlist. Commands and command arguments are never read
 * from a client request, which prevents this endpoint from becoming a remote shell.
 */
export function getSandboxRegistry(): SandboxTool[] {
  const raw = process.env.SANDBOX_TOOL_REGISTRY?.trim();
  if (!raw) return [];

  try {
    return registrySchema.parse(JSON.parse(raw)).tools;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid JSON';
    throw new Error(`Invalid SANDBOX_TOOL_REGISTRY: ${reason}`);
  }
}

export function getSandboxTool(id: string) {
  return getSandboxRegistry().find((tool) => tool.id === id);
}

export function listSandboxTools(): PublicSandboxTool[] {
  return getSandboxRegistry().map(({ id, label, description, kind }) => ({ id, label, description, kind }));
}

export function getSandboxPackages() {
  return [...new Set(getSandboxRegistry().flatMap((tool) => tool.install))];
}
