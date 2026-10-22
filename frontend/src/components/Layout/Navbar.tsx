'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LogOut, MessageSquare, Library, BookOpenText, Sparkles, UserRound, Newspaper } from 'lucide-react';
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
        { name: '知识库', href: '/knowledge', icon: BookOpenText },
        { name: '探索', href: '/explore', icon: Library },
        { name: '产品资讯', href: '/news', icon: Newspaper },
    ];

    return (
        <nav className="app-navbar fixed inset-x-0 top-0 z-50 border-b border-hairline bg-paper/85 backdrop-blur-md">
            <div className="max-w-5xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
                {/* Logo */}
                <Link href="/" aria-label="ProductThink 首页" className="flex shrink-0 items-center gap-2 group">
                    <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center text-paper transition-transform group-hover:scale-105">
                        <Sparkles size={18} fill="currentColor" />
                    </div>
                    <span className="hidden sm:inline font-serif text-xl tracking-tight text-ink">
                        Product<span className="text-ink-muted">Think.</span>
                    </span>
                </Link>

                {/* Navigation — segmented pill control */}
                <div className="flex items-center bg-surface-sunken p-1 rounded-full border border-hairline">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={clsx(
                                    "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-2 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                                    isActive
                                        ? "bg-surface-raised text-ink shadow-sm"
                                        : "text-ink-muted hover:text-ink hover:bg-surface-raised/60"
                                )}
                            >
                                <Icon size={16} aria-hidden="true" className="hidden sm:block" />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>

                <div className="relative shrink-0">
                    <button
                        type="button"
                        className="inline-flex h-9 max-w-[132px] items-center gap-2 rounded-full border border-hairline bg-surface px-2 text-sm text-ink-secondary transition hover:border-hairline-strong hover:bg-surface-raised"
                        onClick={() => setIsProfileOpen(value => !value)}
                        aria-label="个人信息"
                        aria-expanded={isProfileOpen}
                    >
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="头像" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
                                {user ? avatarText : <UserRound size={14} />}
                            </span>
                        )}
                        <span className="hidden truncate text-xs font-medium sm:block">{displayName}</span>
                    </button>
                    {isProfileOpen ? (
                        <>
                            <button className="fixed inset-0 z-40 cursor-default" aria-label="关闭个人信息" onClick={() => setIsProfileOpen(false)} />
                            <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-hairline bg-surface-raised p-3 shadow-float">
                                <div className="flex items-center gap-3 border-b border-hairline pb-3">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">{avatarText}</span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-ink">{displayName}</p>
                                        <p className="truncate text-xs text-ink-muted">{user?.email || '当前以访客身份使用'}</p>
                                    </div>
                                </div>
                                {user ? (
                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-ink-secondary transition hover:bg-surface-sunken hover:text-ink"
                                    >
                                        <LogOut size={14} />
                                        退出登录
                                    </button>
                                ) : (
                                    <p className="mt-3 px-2 text-xs leading-relaxed text-ink-muted">登录后可同步和管理你的对话记录。</p>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </nav>
    );
}
