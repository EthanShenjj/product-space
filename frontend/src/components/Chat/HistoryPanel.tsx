'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, History, MessageSquare, PenSquare, Plus, Trash2 } from 'lucide-react';

interface ConversationItem {
  id: string;
  sessionId: string;
  title: string;
  stage: string;
  messageCount: number;
  productTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface HistoryPanelProps {
    isOpen: boolean;
    onClose?: () => void;
    onSelectConversation: (sessionId: string) => void;
    onNewConversation?: () => void;
    currentSessionId?: string;
    refreshKey?: string | number;
}

const stageLabels: Record<string, string> = {
  info: '信息收集',
  deep: '深度追问',
  analysis: '多视角分析',
};

export default function HistoryPanel({
  isOpen,
  onClose,
  onSelectConversation,
  onNewConversation,
  currentSessionId,
  refreshKey,
}: HistoryPanelProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, refreshKey]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/conversation/history');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个对话吗？')) return;

    setDeletingId(sessionId);
    try {
      const res = await fetch(`/api/conversation/${sessionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.sessionId !== sessionId));
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed left-0 top-16 bottom-0 z-30 hidden w-80 flex-col border-r border-gray-100 bg-[#fbfbfb] xl:flex">
      <div className="space-y-1 px-3 py-4">
        <button
          type="button"
          onClick={() => onNewConversation ? onNewConversation() : window.location.reload()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100"
        >
          <PenSquare size={18} />
          新对话
          <Plus size={16} className="ml-auto text-gray-400" />
        </button>
        <Link
          href="/explore"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
        >
          <BookOpen size={18} />
          灵感火花
        </Link>
      </div>

      <div className="mx-3 border-t border-gray-200" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <div className="mb-2 flex items-center gap-2 px-3 text-xs font-medium text-gray-400">
          <History size={14} />
          最近对话
        </div>
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center text-gray-400">
            <MessageSquare className="mb-3 h-8 w-8 opacity-50" />
            <p className="text-sm">暂无已保存的对话</p>
            <p className="mt-1 text-xs leading-relaxed">开始交流后，记录会自动出现在这里。</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map(conv => {
              const selected = currentSessionId === conv.sessionId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.sessionId);
                    onClose?.();
                  }}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition ${
                    selected ? 'bg-gray-200/70 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MessageSquare size={15} className={selected ? 'shrink-0 text-gray-700' : 'shrink-0 text-gray-400'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{conv.productTitle || conv.title || '未命名对话'}</p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">
                      {stageLabels[conv.stage] || '信息收集'} · {conv.messageCount} 条消息 · {formatDate(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => handleDelete(conv.sessionId, event)}
                    disabled={deletingId === conv.sessionId}
                    className="rounded p-1 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`删除 ${conv.productTitle || conv.title || '对话'}`}
                  >
                    {deletingId === conv.sessionId ? (
                      <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                    ) : <Trash2 size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
