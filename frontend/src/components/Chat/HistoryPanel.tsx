'use client';

import { useState, useEffect } from 'react';
import { History, MessageSquare, Trash2, X, ChevronRight } from 'lucide-react';

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
  onClose: () => void;
  onSelectConversation: (sessionId: string) => void;
  currentSessionId?: string;
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
  currentSessionId,
}: HistoryPanelProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

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
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <span className="font-medium">历史对话</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
              <p>暂无历史对话</p>
              <p className="text-sm mt-1">开始新对话后会自动保存</p>
            </div>
          ) : (
            <div className="py-2">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.sessionId);
                    onClose();
                  }}
                  className={`group px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    currentSessionId === conv.sessionId ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {conv.productTitle || conv.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                          {stageLabels[conv.stage] || conv.stage}
                        </span>
                        <span className="text-xs text-gray-400">
                          {conv.messageCount} 条消息
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(conv.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDelete(conv.sessionId, e)}
                        disabled={deletingId === conv.sessionId}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                      >
                        {deletingId === conv.sessionId ? (
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部：新建对话按钮 */}
        <div className="p-4 border-t">
          <button
            onClick={() => {
              // 清除当前 session，开始新对话
              sessionStorage.removeItem('track_session_id');
              window.location.reload();
            }}
            className="w-full py-2.5 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            开始新对话
          </button>
        </div>
      </div>
    </>
  );
}
