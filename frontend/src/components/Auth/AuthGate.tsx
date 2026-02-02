'use client';

import { useState, useEffect, ReactNode, createContext, useContext } from 'react';
import { Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';

// 用户类型
interface User {
  id: string;
  email: string;
  nickname?: string;
  avatarUrl?: string;
}

// 认证上下文
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// 登录/注册表单类型
type FormMode = 'login' | 'register' | 'register-verify' | 'register-password' | 'forgot' | 'forgot-verify' | 'forgot-password';

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<FormMode>('login');

  // 表单状态
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 检查登录状态
  useEffect(() => {
    checkAuth();
  }, []);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setCode('');
    setError('');
    setShowPassword(false);
  };

  const switchMode = (newMode: FormMode) => {
    setMode(newMode);
    setError('');
    if (newMode === 'login' || newMode === 'register' || newMode === 'forgot') {
      setCode('');
      setPassword('');
    }
  };

  // 发送验证码
  const sendCode = async (type: 'register' | 'reset_password') => {
    if (!email) {
      setError('请输入邮箱');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '发送失败');
        return;
      }

      setCountdown(60);
      // 切换到验证码输入界面
      if (type === 'register') {
        setMode('register-verify');
      } else {
        setMode('forgot-verify');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 验证验证码并进入设置密码
  const verifyCode = async () => {
    if (!code || code.length !== 6) {
      setError('请输入 6 位验证码');
      return;
    }
    // 直接进入设置密码界面，实际验证在提交时进行
    if (mode === 'register-verify') {
      setMode('register-password');
    } else {
      setMode('forgot-password');
    }
    setError('');
  };

  // 登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }

      setUser(data.user);
      resetForm();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('请设置密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '注册失败');
        return;
      }

      setUser(data.user);
      resetForm();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 重置密码
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('请设置新密码');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '重置失败');
        return;
      }

      setUser(data.user);
      resetForm();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  // 已登录
  if (user) {
    return (
      <AuthContext.Provider value={{ user, isLoading, logout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // 渲染表单
  const renderForm = () => {
    switch (mode) {
      case 'login':
        return (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '登录中...' : '登录'}
            </button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-gray-500 hover:text-black"
              >
                注册账号
              </button>
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-gray-500 hover:text-black"
              >
                忘记密码？
              </button>
            </div>
          </form>
        );

      case 'register':
        return (
          <form onSubmit={(e) => { e.preventDefault(); sendCode('register'); }} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '发送中...' : '发送验证码'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4" />
              返回登录
            </button>
          </form>
        );

      case 'register-verify':
      case 'forgot-verify':
        return (
          <form onSubmit={(e) => { e.preventDefault(); verifyCode(); }} className="space-y-4">
            <p className="text-sm text-gray-500 text-center mb-4">
              验证码已发送至 <span className="text-black">{email}</span>
            </p>
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="请输入 6 位验证码"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-center text-2xl tracking-widest"
                autoFocus
                maxLength={6}
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={code.length !== 6}
              className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一步
            </button>
            <div className="text-center">
              {countdown > 0 ? (
                <span className="text-sm text-gray-400">{countdown}s 后可重新发送</span>
              ) : (
                <button
                  type="button"
                  onClick={() => sendCode(mode === 'register-verify' ? 'register' : 'reset_password')}
                  disabled={isSubmitting}
                  className="text-sm text-gray-500 hover:text-black"
                >
                  重新发送验证码
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => switchMode(mode === 'register-verify' ? 'register' : 'forgot')}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
          </form>
        );

      case 'register-password':
        return (
          <form onSubmit={handleRegister} className="space-y-4">
            <p className="text-sm text-gray-500 text-center mb-4">
              设置您的登录密码
            </p>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="设置密码"
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '注册中...' : '完成注册'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('register-verify')}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
          </form>
        );

      case 'forgot':
        return (
          <form onSubmit={(e) => { e.preventDefault(); sendCode('reset_password'); }} className="space-y-4">
            <p className="text-sm text-gray-500 text-center mb-4">
              输入您的注册邮箱，我们将发送验证码
            </p>
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '发送中...' : '发送验证码'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4" />
              返回登录
            </button>
          </form>
        );

      case 'forgot-password':
        return (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-gray-500 text-center mb-4">
              设置您的新密码
            </p>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="新密码"
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '重置中...' : '重置密码'}
            </button>
            <button
              type="button"
              onClick={() => switchMode('forgot-verify')}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
          </form>
        );
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login':
        return '登录';
      case 'register':
      case 'register-verify':
      case 'register-password':
        return '注册';
      case 'forgot':
      case 'forgot-verify':
      case 'forgot-password':
        return '重置密码';
    }
  };

  // 未登录，显示登录/注册表单
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="https://productthink.vivi.wiki/avatars/bot-avatar.jpg"
            alt="ProductThink"
            className="w-16 h-16 rounded-full mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{getTitle()}</h1>
          <p className="text-gray-500">ProductThink · 产品咨询顾问团</p>
        </div>

        {renderForm()}

        <p className="mt-6 text-center text-sm text-gray-400">
          先去 <a href="/explore" className="text-black underline">灵感火花</a> 看看？
        </p>
      </div>
    </div>
  );
}
