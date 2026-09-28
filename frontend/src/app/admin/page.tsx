'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';

interface CmsItem {
    id: string;
    title: string;
    category: string;
    content: string;
    source?: string;
    tags: string[];
    fullArticle?: string;
    status: 'pending' | 'published';
    createdAt: string;
    updatedAt: string;
}

const STATUS_LABELS: Record<CmsItem['status'], string> = {
    pending: '待发布',
    published: '已发布',
};

const EMPTY_FORM: Omit<CmsItem, 'id' | 'createdAt' | 'updatedAt'> = {
    title: '',
    category: '其他',
    content: '',
    source: '',
    tags: [],
    fullArticle: '',
    status: 'pending',
};

export default function AdminPage() {
    const [authed, setAuthed] = useState(false);
    const [password, setPassword] = useState('');
    const [items, setItems] = useState<CmsItem[]>([]);
    const [filter, setFilter] = useState<'all' | CmsItem['status']>('all');
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [bulkJson, setBulkJson] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [lastImageUrls, setLastImageUrls] = useState<string[]>([]);
    const [insertMode, setInsertMode] = useState<'cursor' | 'append'>('cursor');
    const fullArticleRef = useRef<HTMLTextAreaElement | null>(null);
    const [activeAction, setActiveAction] = useState<{ id: string; type: 'edit' | 'publish' | 'retract' } | null>(null);
    const [fullscreenEdit, setFullscreenEdit] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);

    const fetchItems = async () => {
        const res = await fetch('/api/admin/sparks');
        if (res.ok) {
            const data = await res.json();
            setItems(data.items || []);
            setAuthed(true);
        } else {
            setAuthed(false);
        }
    };

    useEffect(() => {
        void fetchItems();
    }, []);

    const filteredItems = useMemo(() => {
        if (filter === 'all') return items;
        return items.filter(item => item.status === filter);
    }, [filter, items]);

    const login = async () => {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (res.ok) {
            setAuthed(true);
            setPassword('');
            await fetchItems();
        } else {
            alert('密码错误');
        }
    };

    const logout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        setAuthed(false);
    };

    const submitForm = async (overrideStatus?: CmsItem['status']) => {
        const payload = {
            ...form,
            tags: form.tags.filter(Boolean),
            status: overrideStatus || form.status,
        };
        if (editingId) {
            await fetch(`/api/admin/sparks/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } else {
            await fetch('/api/admin/sparks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        setForm(EMPTY_FORM);
        setEditingId(null);
        setEditModalOpen(false);
        await fetchItems();
    };

    const publishItem = async (id: string, status: CmsItem['status']) => {
        const type = status === 'published' ? 'publish' : 'retract';
        setActiveAction({ id, type });
        await fetch('/api/admin/sparks/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        });
        await fetchItems();
        setActiveAction(null);
    };

    const deleteItem = async (id: string) => {
        if (!confirm('确定删除这条卡片吗？')) return;
        await fetch(`/api/admin/sparks/${id}`, { method: 'DELETE' });
        await fetchItems();
    };

    const startEdit = (item: CmsItem) => {
        setEditingId(item.id);
        setForm({
            title: item.title,
            category: item.category,
            content: item.content,
            source: item.source || '',
            tags: item.tags || [],
            fullArticle: item.fullArticle || '',
            status: item.status,
        });
        setEditModalOpen(true);
    };

    const openNewCard = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const handleBulkImport = async () => {
        let parsed: any[];
        try {
            parsed = JSON.parse(bulkJson);
        } catch {
            alert('JSON 格式不正确');
            return;
        }
        if (!Array.isArray(parsed)) {
            alert('请提供数组格式');
            return;
        }
        for (const entry of parsed) {
            await fetch('/api/admin/sparks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: entry.title || '未命名',
                    category: entry.category || '其他',
                    content: entry.content || '',
                    source: entry.source || '',
                    tags: Array.isArray(entry.tags) ? entry.tags : [],
                    fullArticle: entry.fullArticle || '',
                    status: entry.status === 'approved' || entry.status === 'draft' ? 'pending' : (entry.status || 'pending'),
                }),
            });
        }
        setBulkJson('');
        await fetchItems();
    };

    const syncCards = async () => {
        setSyncError('');
        setSyncing(true);
        try {
            const res = await fetch('/api/admin/sparks/sync', { method: 'POST' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || '同步失败');
            }
            await fetchItems();
        } catch (error) {
            setSyncError(error instanceof Error ? error.message : '同步失败');
        } finally {
            setSyncing(false);
        }
    };

    const insertIntoFullArticle = (text: string) => {
        setForm(prev => {
            const current = prev.fullArticle || '';
            if (insertMode === 'cursor' && fullArticleRef.current) {
                const textarea = fullArticleRef.current;
                const start = textarea.selectionStart ?? current.length;
                const end = textarea.selectionEnd ?? start;
                const next = `${current.slice(0, start)}${text}${current.slice(end)}`;
                requestAnimationFrame(() => {
                    const pos = start + text.length;
                    textarea.focus();
                    textarea.setSelectionRange(pos, pos);
                });
                return { ...prev, fullArticle: next };
            }
            const next = current ? `${current}\n\n${text}` : text;
            return { ...prev, fullArticle: next };
        });
    };

    const handleImageUpload = async (files: File[]) => {
        setUploadError('');
        setUploading(true);
        const uploaded: string[] = [];
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/admin/upload-image', {
                    method: 'POST',
                    body: formData,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || '上传失败');
                }
                const data = await res.json();
                const url = data.url as string;
                if (url) {
                    const markdown = `![image](${url})`;
                    insertIntoFullArticle(markdown);
                    uploaded.push(url);
                }
            }
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : '上传失败');
        } finally {
            if (uploaded.length) {
                setLastImageUrls(prev => [...uploaded, ...prev].slice(0, 5));
            }
            setUploading(false);
        }
    };

    if (!authed) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="w-full max-w-sm card p-6">
                    <h1 className="font-serif text-xl text-ink mb-4">Sparks 管理后台</h1>
                    <label className="micro-label block">管理员密码</label>
                    <input
                        type="password"
                        className="input-field mt-2 px-3 py-2"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                    />
                    <button
                        onClick={login}
                        className="btn-primary mt-4 w-full py-2 text-sm"
                    >
                        登录
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-serif text-2xl text-ink">Sparks 管理后台</h1>
                    <p className="text-sm text-ink-muted">上传、编辑、发布</p>
                </div>
                <button onClick={logout} className="text-sm text-ink-muted hover:text-ink">
                    退出登录
                </button>
            </header>

            <section className="grid lg:grid-cols-[1fr_320px] gap-6 mb-10">
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">卡片管理</h2>
                        <button
                            onClick={openNewCard}
                            className="btn-primary px-4 py-2 text-sm"
                        >
                            + 新建卡片
                        </button>
                    </div>
                    <p className="text-sm text-ink-muted">点击下方卡片列表中的"编辑"按钮，或点击右上角新建卡片。</p>
                </div>

                <div className="card p-6">
                    <h2 className="text-lg font-semibold mb-4">批量导入</h2>
                    <textarea
                        className="input-field px-3 py-2 min-h-[200px]"
                        placeholder='JSON 数组格式，例如：[{"title":"...","content":"..."}]'
                        value={bulkJson}
                        onChange={event => setBulkJson(event.target.value)}
                    />
                    <button
                        type="button"
                        onClick={handleBulkImport}
                        className="btn-secondary mt-3 w-full py-2 text-sm"
                    >
                        导入
                    </button>
                    <button
                        type="button"
                        onClick={syncCards}
                        className="btn-secondary mt-3 w-full py-2 text-sm"
                        disabled={syncing}
                    >
                        {syncing ? '同步中…' : '同步待发布 + 已发布'}
                    </button>
                    {syncError ? (
                        <p className="mt-2 text-xs text-danger">{syncError}</p>
                    ) : null}
                </div>
            </section>

            <section className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-lg font-semibold">卡片列表</h2>
                    <div className="flex gap-2">
                        {['all', 'pending', 'published'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilter(status as any)}
                                className={`px-3 py-1.5 text-xs rounded-full border ${
                                    filter === status
                                        ? 'bg-ink text-paper border-ink'
                                        : 'border-hairline text-ink-secondary hover:border-hairline-strong'
                                }`}
                            >
                                {status === 'all' ? '全部' : STATUS_LABELS[status as CmsItem['status']]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y">
                    {filteredItems.map(item => (
                        <div key={item.id} className="py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                            <div className="flex-1">
                                <div className="text-sm font-semibold text-ink">{item.title}</div>
                                <div className="text-xs text-ink-muted mt-1">{item.content}</div>
                                <div className="text-xs text-ink-faint mt-1">
                                    {item.category} · {item.source || '无来源'} · {STATUS_LABELS[item.status]}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                                {item.status === 'pending' && (
                                    <>
                                        <button
                                            type="button"
                                            className={`border border-hairline rounded-full px-3 py-1 transition ${
                                                activeAction?.id === item.id && activeAction.type === 'edit'
                                                    ? 'ring-2 ring-ink/30 bg-surface-sunken'
                                                    : 'hover:border-hairline-strong'
                                            }`}
                                            onClick={() => startEdit(item)}
                                        >
                                            编辑
                                        </button>
                                        <button
                                            type="button"
                                            className={`border border-hairline rounded-full px-3 py-1 transition ${
                                                activeAction?.id === item.id && activeAction.type === 'publish'
                                                    ? 'ring-2 ring-score/40 bg-score-bg'
                                                    : 'hover:border-hairline-strong'
                                            }`}
                                            onClick={() => publishItem(item.id, 'published')}
                                            disabled={activeAction?.id === item.id && activeAction.type === 'publish'}
                                        >
                                            发布
                                        </button>
                                    </>
                                )}
                                {item.status === 'published' && (
                                    <>
                                        <button
                                            type="button"
                                            className={`border border-hairline rounded-full px-3 py-1 transition ${
                                                activeAction?.id === item.id && activeAction.type === 'edit'
                                                    ? 'ring-2 ring-ink/30 bg-surface-sunken'
                                                    : 'hover:border-hairline-strong'
                                            }`}
                                            onClick={() => startEdit(item)}
                                        >
                                            编辑
                                        </button>
                                        <button
                                            type="button"
                                            className={`border border-hairline rounded-full px-3 py-1 transition ${
                                                activeAction?.id === item.id && activeAction.type === 'retract'
                                                    ? 'ring-2 ring-warn/40 bg-warn-bg'
                                                    : 'hover:border-hairline-strong'
                                            }`}
                                            onClick={() => publishItem(item.id, 'pending')}
                                            disabled={activeAction?.id === item.id && activeAction.type === 'retract'}
                                        >
                                            撤回到待发布
                                        </button>
                                    </>
                                )}
                                <button
                                    type="button"
                                    className="border border-danger/30 text-danger rounded-full px-3 py-1"
                                    onClick={() => deleteItem(item.id)}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 编辑/新建卡片弹窗 */}
            {editModalOpen && (
                <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
                    <div className="bg-surface-raised rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-hairline">
                            <h3 className="font-serif text-lg">
                                {editingId ? '编辑卡片' : '新建卡片'}
                            </h3>
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="p-2 hover:bg-surface-sunken rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto space-y-4">
                            <div>
                                <label className="micro-label block mb-1">标题</label>
                                <input
                                    className="input-field px-3 py-2"
                                    placeholder="输入标题"
                                    value={form.title}
                                    onChange={event => setForm({ ...form, title: event.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="micro-label block mb-1">分类</label>
                                    <input
                                        className="input-field px-3 py-2"
                                        placeholder="如：产品沉思录"
                                        value={form.category}
                                        onChange={event => setForm({ ...form, category: event.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="micro-label block mb-1">来源（可空）</label>
                                    <input
                                        className="input-field px-3 py-2"
                                        placeholder="如：Lenny's Newsletter"
                                        value={form.source}
                                        onChange={event => setForm({ ...form, source: event.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="micro-label block mb-1">标签（逗号分隔）</label>
                                <input
                                    className="input-field px-3 py-2"
                                    placeholder="如：增长, PMF, 用户留存"
                                    value={form.tags.join(',')}
                                    onChange={event =>
                                        setForm({
                                            ...form,
                                            tags: event.target.value.split(',').map(tag => tag.trim()).filter(Boolean),
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <label className="micro-label block mb-1">一句话总结</label>
                                <textarea
                                    className="input-field px-3 py-2 min-h-[80px]"
                                    placeholder="用一句话概括这张卡片的核心观点"
                                    value={form.content}
                                    onChange={event => setForm({ ...form, content: event.target.value })}
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="micro-label block">全文（可选）</label>
                                    <button
                                        type="button"
                                        onClick={() => setFullscreenEdit(true)}
                                        className="text-xs text-ink-muted hover:text-ink flex items-center gap-1"
                                    >
                                        <Maximize2 size={12} />
                                        全屏编辑
                                    </button>
                                </div>
                                <textarea
                                    className="input-field px-3 py-2 min-h-[120px]"
                                    placeholder="详细内容，支持 Markdown 格式"
                                    value={form.fullArticle}
                                    onChange={event => setForm({ ...form, fullArticle: event.target.value })}
                                    ref={fullArticleRef}
                                />
                            </div>
                            <div>
                                <label className="micro-label block mb-1">上传图片</label>
                                <div className="border border-hairline rounded-lg px-3 py-3 bg-surface-sunken">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-ink-muted">插入位置</span>
                                        {(['cursor', 'append'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setInsertMode(mode)}
                                                className={`text-xs px-2 py-1 rounded-full border ${
                                                    insertMode === mode
                                                        ? 'bg-ink text-paper border-ink'
                                                        : 'border-hairline text-ink-secondary bg-surface-raised'
                                                }`}
                                            >
                                                {mode === 'cursor' ? '光标处' : '末尾追加'}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        disabled={uploading}
                                        className="text-sm"
                                        onChange={(event) => {
                                            const fileList = event.target.files;
                                            if (fileList && fileList.length) void handleImageUpload(Array.from(fileList));
                                            event.currentTarget.value = '';
                                        }}
                                    />
                                    {uploading && <p className="text-xs text-ink-muted mt-2">上传中…</p>}
                                    {uploadError && <p className="text-xs text-danger mt-2">{uploadError}</p>}
                                </div>
                            </div>
                            <div>
                                <label className="micro-label block mb-1">状态</label>
                                <select
                                    className="input-field px-3 py-2"
                                    value={form.status}
                                    onChange={event => setForm({ ...form, status: event.target.value as CmsItem['status'] })}
                                >
                                    <option value="pending">待发布</option>
                                    <option value="published">已发布</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-4 border-t border-hairline flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="btn-ghost px-4 py-2 text-sm"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={() => submitForm()}
                                className="btn-primary px-4 py-2 text-sm"
                            >
                                {editingId ? '保存修改' : '创建卡片'}
                            </button>
                            <button
                                type="button"
                                onClick={() => submitForm('published')}
                                className="px-4 py-2 text-sm bg-score text-paper rounded-full"
                            >
                                {editingId ? '保存并发布' : '创建并发布'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 全屏编辑模态框 */}
            {fullscreenEdit && (
                <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
                    <div className="bg-surface-raised rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-hairline">
                            <h3 className="font-serif text-lg">全文编辑</h3>
                            <button
                                type="button"
                                onClick={() => setFullscreenEdit(false)}
                                className="p-2 hover:bg-surface-sunken rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-hidden">
                            <textarea
                                className="input-field w-full h-full px-4 py-3 resize-none"
                                placeholder="全文内容..."
                                value={form.fullArticle}
                                onChange={event => setForm({ ...form, fullArticle: event.target.value })}
                                autoFocus
                            />
                        </div>
                        <div className="p-4 border-t flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setFullscreenEdit(false)}
                                className="btn-ghost px-4 py-2 text-sm"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={() => setFullscreenEdit(false)}
                                className="btn-primary px-4 py-2 text-sm"
                            >
                                完成
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
