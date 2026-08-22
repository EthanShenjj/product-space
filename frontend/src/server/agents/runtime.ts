import { Agent, run, setSensitiveDataLoggingEnabled, setTracingDisabled } from '@openai/agents';
import type { AgentInputItem, Model, Session, StreamedRunResult } from '@openai/agents';
import { getAgentModel, getProviderAttempts } from './providers';
import type { CustomModelConfig, ProviderAttempt } from './types';

setTracingDisabled(process.env.AGENTS_TRACE_ENABLED !== 'true');
setSensitiveDataLoggingEnabled(process.env.AGENTS_TRACE_ENABLED === 'true');

export type AgentBuilder = (model: Model) => Agent<any, any>;

export async function runWithFallback(
  buildAgent: AgentBuilder,
  input: string | AgentInputItem[],
  options: { customModel?: CustomModelConfig; session?: Session; stream?: false; workflowName: string; groupId?: string },
) {
  const attempts = getProviderAttempts(options.customModel);
  if (!attempts.length) throw new Error('No AI provider is configured');
  let lastError: unknown;
  for (const provider of attempts) {
    try {
      const result = await run(buildAgent(getAgentModel(provider)), input, {
        session: options.session,
        maxTurns: 8,
      } as any);
      return { result, provider };
    } catch (error) {
      lastError = error;
      console.warn(`[Agents] ${options.workflowName} failed with ${provider.name}; trying the next configured provider.`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All AI providers failed');
}

export async function streamWithFallback(
  buildAgent: AgentBuilder,
  input: string | AgentInputItem[],
  options: { customModel?: CustomModelConfig; session?: Session; workflowName: string; groupId?: string },
): Promise<{ result: StreamedRunResult<any, any>; provider: ProviderAttempt }> {
  const attempts = getProviderAttempts(options.customModel);
  if (!attempts.length) throw new Error('No AI provider is configured');
  let lastError: unknown;
  for (const provider of attempts) {
    try {
      const result = await run(buildAgent(getAgentModel(provider)), input, {
        stream: true,
        session: options.session,
        maxTurns: 8,
      } as any) as StreamedRunResult<any, any>;
      return { result: result as StreamedRunResult<any, any>, provider };
    } catch (error) {
      lastError = error;
      console.warn(`[Agents] ${options.workflowName} failed to start with ${provider.name}; trying the next configured provider.`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All AI providers failed');
}
