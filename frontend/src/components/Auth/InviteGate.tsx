'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Lock } from 'lucide-react';

const DEFAULT_INVITE_CODES = ['productthink', 'vivi'];
const INVITE_CODES = (process.env.NEXT_PUBLIC_INVITE_CODES || '')
  .split(',')
  .map(code => code.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_CODES = INVITE_CODES.length ? INVITE_CODES : DEFAULT_INVITE_CODES;
const STORAGE_KEY = 'invite_verified';
const STORAGE_CODE_KEY = 'invite_code';

interface InviteGateProps {
  children: ReactNode;
}

export default function InviteGate({ children }: InviteGateProps) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const verified = localStorage.getItem(STORAGE_KEY);
    setIsVerified(verified === 'true');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toLowerCase();
    if (ALLOWED_CODES.includes(normalized)) {
      localStorage.setItem(STORAGE_KEY, 'true');
      localStorage.setItem(STORAGE_CODE_KEY, normalized);
      setIsVerified(true);
      setError('');
    } else {
      setError('邀请码不正确，请重试');
    }
  };

  // 加载中
  if (isVerified === null) {
    return null;
  }

  // 已验证
  if (isVerified) {
    return <>{children}</>;
  }

  // 未验证，显示输入框
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-surface rounded-full mb-4 shadow-card">
            <Lock className="w-8 h-8 text-ink" />
          </div>
          <h1 className="font-serif text-2xl text-ink mb-2">内测邀请</h1>
          <p className="text-ink-muted">请输入邀请码以访问深度对话功能</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="请输入邀请码"
            className="input-field input-pill w-full px-4 py-3 text-center text-lg"
            autoFocus
          />
          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            className="btn-primary w-full py-3 text-sm"
          >
            验证
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-faint">
          没有邀请码？可以先去 <a href="/explore" className="u-link text-ink">灵感火花</a> 看看
        </p>
      </div>
    </div>
  );
}
