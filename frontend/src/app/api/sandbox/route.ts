import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/admin/_lib';
import { getSandboxTool, listSandboxTools } from '@/server/sandbox/registry';
import { runSandboxTool } from '@/server/sandbox/runner';

export const runtime = 'nodejs';
export const maxDuration = 60;

const runRequestSchema = z.object({
  toolId: z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/),
  input: z.unknown().optional(),
});

const MAX_INPUT_CHARS = 32_000;
const MAX_RUNS_PER_MINUTE = 5;
const recentRuns = new Map<string, number[]>();

function isEnabled() {
  return process.env.SANDBOX_ENABLED === 'true';
}

function canRun(request: NextRequest) {
  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const runs = (recentRuns.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
  if (runs.length >= MAX_RUNS_PER_MINUTE) return false;
  recentRuns.set(key, [...runs, now]);
  return true;
}

async function assertAuthorized() {
  if (!isEnabled()) {
    return NextResponse.json({ error: 'Sandbox is disabled' }, { status: 503 });
  }
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Admin access is required' }, { status: 403 });
  }
  return null;
}

/** Returns only display metadata; command, args, install packages, and network policy stay server-only. */
export async function GET() {
  const denied = await assertAuthorized();
  if (denied) return denied;

  try {
    return NextResponse.json({ tools: listSandboxTools() });
  } catch (error) {
    console.error('[Sandbox] registry error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Sandbox registry is unavailable' }, { status: 503 });
  }
}
export async function POST(request: NextRequest) {
  const denied = await assertAuthorized();
  if (denied) return denied;
  if (!canRun(request)) return NextResponse.json({ error: 'Too many sandbox runs. Try again shortly.' }, { status: 429 });

  try {
    const payload = runRequestSchema.safeParse(await request.json());
    if (!payload.success) return NextResponse.json({ error: 'Invalid sandbox request' }, { status: 400 });
    if (JSON.stringify(payload.data.input ?? {}).length > MAX_INPUT_CHARS) {
      return NextResponse.json({ error: 'Sandbox input exceeds 32 KB' }, { status: 413 });
    }

    const tool = getSandboxTool(payload.data.toolId);
    if (!tool) return NextResponse.json({ error: 'Unknown sandbox tool' }, { status: 404 });

    const result = await runSandboxTool(tool, payload.data.input);
    return NextResponse.json({ ok: result.exitCode === 0, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sandbox] run failed:', message);
    return NextResponse.json({ error: 'Sandbox execution failed' }, { status: 502 });
  }
}
