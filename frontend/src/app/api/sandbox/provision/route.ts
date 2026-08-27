import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { proposalToSandboxTool, sandboxProposalSchema } from '@/server/sandbox/proposal';
import { provisionSandboxTool } from '@/server/sandbox/runner';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (process.env.SANDBOX_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Sandbox provisioning is disabled' }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please sign in before creating a personal sandbox tool' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Sandbox storage is unavailable' }, { status: 503 });

  try {
    const body = await request.json();
    const proposal = sandboxProposalSchema.safeParse(body?.proposal);
    const conversationSessionId = typeof body?.sessionId === 'string' ? body.sessionId.slice(0, 100) : null;
    if (!proposal.success) return NextResponse.json({ error: 'Invalid sandbox proposal' }, { status: 400 });

    const tool = proposalToSandboxTool(proposal.data);
    const baseRecord = {
      user_id: user.userId,
      conversation_session_id: conversationSessionId,
      tool_id: tool.id,
      kind: tool.kind,
      label: tool.label,
      description: tool.description,
      command: tool.command,
      args: tool.args,
      network: tool.network,
      install: tool.install,
      status: 'provisioning',
      snapshot_id: null,
      error_message: null,
    };

    const { error: savingError } = await supabaseAdmin
      .from('sandbox_tools')
      .upsert(baseRecord, { onConflict: 'user_id,tool_id' });
    if (savingError) throw new Error('Could not reserve sandbox tool');

    try {
      const snapshotId = await provisionSandboxTool(tool);
      const { error: readyError } = await supabaseAdmin
        .from('sandbox_tools')
        .update({ status: 'ready', snapshot_id: snapshotId, error_message: null })
        .eq('user_id', user.userId)
        .eq('tool_id', tool.id);
      if (readyError) throw new Error('Tool image was created but could not be saved');

      return NextResponse.json({
        ok: true,
        tool: { id: tool.id, label: tool.label, kind: tool.kind, status: 'ready' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Sandbox provisioning failed';
      await supabaseAdmin
        .from('sandbox_tools')
        .update({ status: 'failed', error_message: message })
        .eq('user_id', user.userId)
        .eq('tool_id', tool.id);
      return NextResponse.json({ error: 'Sandbox tool could not be created' }, { status: 502 });
    }
  } catch (error) {
    console.error('[Sandbox] provisioning request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Sandbox provisioning failed' }, { status: 500 });
  }
}
