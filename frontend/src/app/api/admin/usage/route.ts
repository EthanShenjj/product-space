import { NextResponse } from 'next/server';
import { requireAdmin } from '../_lib';
import { getActiveProviderNames } from '@/server/agents/providers';

export async function GET() {
  // 验证管理员身份
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeProviders = getActiveProviderNames();
  const primaryProvider = activeProviders[0] || 'None';

  // Cloudsway 用量信息（如果配置了）
  let cloudswayInfo = null;
  if (process.env.CLOUDSWAY_API_KEY) {
    cloudswayInfo = {
      configured: true,
      label: 'Cloudsway',
      model: process.env.CLOUDSWAY_MODEL || 'MaaS_Sonnet_4',
    };
  }

  // VectorEngine 用量信息（如果配置了）
  let vectorEngineInfo = null;
  if (process.env.VECTORENGINE_API_KEY) {
    vectorEngineInfo = {
      configured: true,
      label: 'VectorEngine',
      model: 'Claude 3.5 Sonnet',
    };
  }

  // OpenRouter 用量信息
  let openRouterInfo = null;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const keyInfoRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
        },
      });

      if (keyInfoRes.ok) {
        const keyInfo = await keyInfoRes.json();
        openRouterInfo = {
          configured: true,
          ...(keyInfo.data || keyInfo),
        };
      }
    } catch (error) {
      console.error('Failed to fetch OpenRouter info:', error);
      openRouterInfo = { configured: true, error: 'Failed to fetch usage' };
    }
  }

  return NextResponse.json({
    primaryProvider,
    activeProviders,
    cloudsway: cloudswayInfo,
    vectorEngine: vectorEngineInfo,
    openRouter: openRouterInfo,
    timestamp: new Date().toISOString(),
  });
}
