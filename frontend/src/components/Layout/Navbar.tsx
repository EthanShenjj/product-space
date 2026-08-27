'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LogOut, MessageSquare, Library, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CurrentUser {
    email: string;
    nickname?: string;
    avatarUrl?: string;
}

export default function Navbar() {
    const pathname = usePathname();
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(response => response.ok ? response.json() : null)
            .then(data => setUser(data?.user || null))
            .catch(() => setUser(null));
    }, []);

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        setUser(null);
        setIsProfileOpen(false);
    };

    const displayName = user?.nickname || user?.email?.split('@')[0] || '访客';
    const avatarText = displayName.slice(0, 1).toUpperCase();

    const navItems = [
        { name: '对话', href: '/chat', icon: MessageSquare },
        { name: '探索', href: '/explore', icon: Library },
    ];

    return (
        <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white transistion-transform group-hover:scale-105">
                        <Sparkles size={18} fill="currentColor" />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-gray-900">
                        Product<span className="text-gray-500 font-normal">Think</span>
                    </span>
                </Link>

                {/* Navigation */}
                <div className="flex items-center bg-gray-100/50 p-1 rounded-full border border-gray-200/50">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-white text-black shadow-sm ring-1 ring-black/5"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                                )}
                            >
                                <Icon size={16} />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>

                <div className="relative">
                    <button
                        type="button"
                        className="inline-flex h-9 max-w-[132px] items-center gap-2 rounded-full border border-gray-200 bg-white px-2 text-sm text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                        onClick={() => setIsProfileOpen(value => !value)}
                        aria-label="个人信息"
                        aria-expanded={isProfileOpen}
                    >
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="头像" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                                {user ? avatarText : <UserRound size={14} />}
                            </span>
                        )}
                        <span className="hidden truncate text-xs font-medium sm:block">{displayName}</span>
                    </button>
                    {isProfileOpen ? (
                        <>
                            <button className="fixed inset-0 z-40 cursor-default" aria-label="关闭个人信息" onClick={() => setIsProfileOpen(false)} />
                            <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">{avatarText}</span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                                        <p className="truncate text-xs text-gray-500">{user?.email || '当前以访客身份使用'}</p>
                                    </div>
                                </div>
                                {user ? (
                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                                    >
                                        <LogOut size={14} />
                                        退出登录
                                    </button>
                                ) : (
                                    <p className="mt-3 px-2 text-xs leading-relaxed text-gray-500">登录后可同步和管理你的对话记录。</p>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </nav>
    );
}
