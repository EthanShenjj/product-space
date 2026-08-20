'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from './useChat';
import { PhaseIndicator, MessageList, ChatInput, Sidebar } from './components';

function ChatContent() {
    const {
        input,
        setInput,
        isLoading,
        isSummarizing,
        messages,
        summary,
        messagesEndRef,
        isUserScrollingRef,
        currentStage,
        stageConfig,
        deepTurns,
        minDeepTurns,
        models,
        selectedModelId,
        selectModel,
        addModel,
        deleteModel,
        handleSend,
        handleQuickSend,
    } = useChat();

    const prevStageRef = useRef(currentStage);
    const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

    useEffect(() => {
        let nextToast: { title: string; body: string } | null = null;
        if (prevStageRef.current !== currentStage) {
            if (currentStage === 'deep') {
                nextToast = {
                    title: '进入 Step 2',
                    body: '我会开始追问关键假设，帮你把问题想清楚～',
                };
            } else if (currentStage === 'analysis') {
                nextToast = {
                    title: 'Step 3 就绪啦',
                    body: '多视角分析已经准备好，你可以随时进入生成报告。',
                };
            }
            prevStageRef.current = currentStage;
        }

        if (!nextToast) return;
        const timer = setTimeout(() => setToast(nextToast), 0);
        return () => clearTimeout(timer);
    }, [currentStage]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2400);
        return () => clearTimeout(timer);
    }, [toast]);

    return (
        <div className="h-[calc(100dvh-64px)] min-h-[calc(100dvh-64px)] w-full relative">
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
                        models={models}
                        selectedModelId={selectedModelId}
                        onSelectModel={selectModel}
                        onAddModel={addModel}
                        onDeleteModel={deleteModel}
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
    return <ChatContent />;
}
