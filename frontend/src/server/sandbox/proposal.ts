import { tool } from '@openai/agents';
import { z } from 'zod';
import { sandboxToolSchema, type SandboxTool } from './registry';

const packageNameSchema = z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i);
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i);
const domainSchema = z.string().regex(/^(?:\*\.)?[a-z0-9][a-z0-9.-]*[a-z0-9]$/i);

export const sandboxProposalSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/),
  kind: z.enum(['cli', 'mcp', 'skill']),
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  packageName: packageNameSchema,
  packageVersion: versionSchema,
  command: z.string().regex(/^[a-zA-Z0-9._/-]+$/),
  args: z.array(z.string().max(512)).max(16).default([]),
  network: z.array(domainSchema).max(10).default([]),
  reason: z.string().min(1).max(300),
});

export type SandboxProposal = z.infer<typeof sandboxProposalSchema>;

export function proposalToSandboxTool(proposal: SandboxProposal): SandboxTool {
  return sandboxToolSchema.parse({
    id: proposal.id,
    label: proposal.label,
    description: proposal.description,
    kind: proposal.kind,
    command: proposal.command,
    args: proposal.args,
    input: 'json-file',
    network: proposal.network,
    timeoutMs: 30_000,
    install: [`${proposal.packageName}@${proposal.packageVersion}`],
  });
}

/** This tool is deliberately a proposal only. It never installs software or creates a sandbox. */
export function createSandboxProposalTool() {
  return tool({
    name: 'propose_sandbox_tool',
    description: '仅当用户明确要求在其个人沙箱中安装或添加一个 CLI、MCP 或 Skill 时调用。它只创建待用户确认的安装提案，绝不执行安装。只有在包名、精确版本、固定命令均明确时才调用；否则先询问用户。',
    parameters: sandboxProposalSchema,
    async execute(proposal) {
      return { type: 'sandbox_proposal', proposal };
    },
  });
}
