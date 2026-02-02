'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from './useChat';
import { PhaseIndicator, MessageList, ChatInput, Sidebar } from './components';
import AuthGate, { useAuth } from '@/components/Auth/AuthGate';
import HistoryPanel from '@/components/Chat/HistoryPanel';
import { History, LogOut } from 'lucide-react';

function ChatContent() {
    const {
        input,
        setInput,
        isLoading,
        isSummarizing,
        isLoadingHistory,
        messages,
        summary,
        messagesEndRef,
        isUserScrollingRef,
        currentStage,
        stageConfig,
        deepTurns,
        minDeepTurns,
        currentSessionId,
        handleSend,
        handleQuickSend,
        loadConversation,
    } = useChat();

    const { user, logout } = useAuth();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const prevStageRef = useRef(currentStage);
    const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

    useEffect(() => {
        if (prevStageRef.current !== currentStage) {
            if (currentStage === 'deep') {
                setToast({
                    title: '进入 Step 2',
                    body: '我会开始追问关键假设，帮你把问题想清楚～',
                });
            } else if (currentStage === 'analysis') {
                setToast({
                    title: 'Step 3 就绪啦',
                    body: '多视角分析已经准备好，你可以随时进入生成报告。',
                });
            }
            prevStageRef.current = currentStage;
        }
    }, [currentStage]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2400);
        return () => clearTimeout(timer);
    }, [toast]);

    // 加载历史会话时显示 loading
    if (isLoadingHistory) {
        return (
            <div className="h-[calc(100dvh-64px)] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">加载对话中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100dvh-64px)] min-h-[calc(100dvh-64px)] w-full">
            {/* 顶部工具栏 */}
            <div className="absolute top-2 right-4 flex items-center gap-2 z-30">
                {user && (
                    <>
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <History className="w-4 h-4" />
                            <span className="hidden sm:inline">历史对话</span>
                        </button>
                        <button
                            onClick={logout}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">退出</span>
                        </button>
                    </>
                )}
            </div>

            <div className="grid h-full max-w-6xl mx-auto w-full lg:grid-cols-[1fr_320px] gap-6 px-4">
                <div className="flex flex-col min-h-0">
                    <PhaseIndicator currentStage={currentStage} />
                    <MessageList
                        messages={messages}
                        messagesEndRef={messagesEndRef}
                        isUserScrollingRef={isUserScrollingRef}
                        currentStage={currentStage}
                    />
                    <ChatInput
                        input={input}
                        setInput={setInput}
                        isLoading={isLoading}
                        onSend={handleSend}
                        onQuickSend={handleQuickSend}
                        summary={summary}
                        currentStage={currentStage}
                        canStartAnalysis={currentStage === 'analysis'}
                    />
                </div>
                <Sidebar
                    stageConfig={stageConfig}
                    summary={summary}
                    isSummarizing={isSummarizing}
                    currentStage={currentStage}
                    canStartAnalysis={currentStage === 'analysis'}
                    deepTurns={deepTurns}
                    minDeepTurns={minDeepTurns}
                />
            </div>

            {/* 历史对话面板 */}
            <HistoryPanel
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                onSelectConversation={loadConversation}
                currentSessionId={currentSessionId}
            />

            {toast ? (
                <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-black text-white px-4 py-2 text-xs shadow-lg">
                    <span className="font-semibold">{toast.title}</span>
                    <span className="ml-2 text-gray-300">{toast.body}</span>
                </div>
            ) : null}
        </div>
    );
}

export default function ChatPage() {
    return (
        <AuthGate>
            <ChatContent />
        </AuthGate>
    );
}
