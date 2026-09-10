'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AgentChatDrawer from './AgentChatDrawer';

export interface AgentPanelConfig {
  title: string;
  description: string;
  pageContext: string;
  prompts: string[];
}

const AgentPanelContext = createContext<{ setConfig: (config: AgentPanelConfig) => void } | null>(null);

export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AgentPanelConfig | null>(null);
  const setPanelConfig = useCallback((nextConfig: AgentPanelConfig) => setConfig(nextConfig), []);
  const contextValue = useMemo(() => ({ setConfig: setPanelConfig }), [setPanelConfig]);

  return (
    <AgentPanelContext.Provider value={contextValue}>
      {children}
      {config ? <AgentChatDrawer {...config} /> : null}
    </AgentPanelContext.Provider>
  );
}

export function useAgentPanel(config: AgentPanelConfig) {
  const context = useContext(AgentPanelContext);
  if (!context) throw new Error('useAgentPanel must be used inside AgentPanelProvider');
  useEffect(() => {
    context.setConfig(config);
  }, [config, context]);
}
