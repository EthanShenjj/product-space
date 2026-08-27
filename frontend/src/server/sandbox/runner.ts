import { Sandbox, type NetworkPolicy } from '@vercel/sandbox';
import crypto from 'node:crypto';
import type { SandboxTool } from './registry';

const MAX_OUTPUT_CHARS = 20_000;
const INPUT_FILE = '/tmp/productthink-input.json';

export interface SandboxRunResult {
  operationId: string;
  toolId: string;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
}

function truncate(value: string) {
  return value.length > MAX_OUTPUT_CHARS ? `${value.slice(0, MAX_OUTPUT_CHARS)}\n…输出已截断` : value;
}

/** Avoid returning common credential formats if a package prints its environment or request headers. */
function redact(value: string) {
  return truncate(value)
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)\S+/gi, '$1[REDACTED]')
    .replace(/\b(?:sk-(?:proj-)?|vsk_|ghp_|gho_|github_pat_)[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(/\b(?:ghp|gho)[A-Za-z0-9]{20,}\b/g, '[REDACTED]');
}

function networkPolicy(tool: SandboxTool): NetworkPolicy {
  return tool.network.length ? { allow: tool.network } : 'deny-all';
}

async function createSandbox(tool: SandboxTool) {
  const timeout = Math.min(tool.timeoutMs + 8_000, 58_000);
  const common = {
    timeout,
    resources: { vcpus: 1 },
    networkPolicy: networkPolicy(tool),
    // Host secrets are deliberately never inherited by sandbox processes.
    env: { NO_COLOR: '1' },
  } as const;
  const snapshotId = process.env.SANDBOX_SNAPSHOT_ID?.trim();

  return snapshotId
    ? Sandbox.create({ ...common, source: { type: 'snapshot', snapshotId } })
    : Sandbox.create({ ...common, runtime: 'node24' });
}

/** Builds a user-specific, immutable image. Package installation never happens in the web app process. */
export async function provisionSandboxTool(tool: SandboxTool) {
  if (!tool.install.length) throw new Error('A sandbox tool must declare exact packages to install');
  const sandbox = await Sandbox.create({
    runtime: 'node24',
    timeout: 5 * 60_000,
    resources: { vcpus: 1 },
    // Provisioning may only fetch declared packages from the npm registry.
    networkPolicy: { allow: ['registry.npmjs.org'] },
    env: { NO_COLOR: '1' },
  });

  try {
    const install = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '--global', '--omit=dev', ...tool.install],
      cwd: '/vercel/sandbox',
    });
    const stderr = await install.stderr();
    if (install.exitCode !== 0) {
      throw new Error(`Package installation failed: ${redact(stderr).slice(0, 1_000)}`);
    }

    const snapshot = await sandbox.snapshot({ expiration: 0 });
    return snapshot.snapshotId;
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

/**
 * Runs only a server-registered command inside a one-shot microVM. The caller
 * can supply JSON input, but cannot control the executable, its arguments,
 * working directory, network policy, privileges, or environment variables.
 */
export async function runSandboxTool(tool: SandboxTool, input: unknown): Promise<SandboxRunResult> {
  const operationId = crypto.randomUUID();
  const startedAt = Date.now();
  const sandbox = await createSandbox(tool);

  try {
    if (tool.input === 'json-file') {
      await sandbox.fs.writeFile(INPUT_FILE, JSON.stringify(input ?? {}), 'utf8');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), tool.timeoutMs);
    try {
      const command = await sandbox.runCommand({
        cmd: tool.command,
        args: tool.input === 'json-file' ? [...tool.args, INPUT_FILE] : tool.args,
        cwd: '/vercel/sandbox',
        signal: controller.signal,
      });
      const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
      const result = {
        operationId,
        toolId: tool.id,
        exitCode: command.exitCode,
        durationMs: Date.now() - startedAt,
        stdout: redact(stdout),
        stderr: redact(stderr),
      };
      console.info('[Sandbox] completed', {
        operationId,
        toolId: tool.id,
        sandboxId: sandbox.sandboxId,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      });
      return result;
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}
