'use client';

import { PointerEvent, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import clsx from 'clsx';

export default function FeedbackDrawer() {
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState('');
    const [contact, setContact] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [desktopPosition, setDesktopPosition] = useState<{ x: number; y: number } | null>(null);
    const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
    const skipOpenRef = useRef(false);

    const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: rect.left,
            originY: rect.top,
            moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true;
        const rect = event.currentTarget.getBoundingClientRect();
        setDesktopPosition({
            x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, drag.originX + deltaX)),
            y: Math.max(72, Math.min(window.innerHeight - rect.height - 8, drag.originY + deltaY)),
        });
    };

    const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;
        if (drag?.moved) skipOpenRef.current = true;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const submit = async () => {
        if (!content.trim()) {
            setStatus('error');
            setMessage('请填写意见内容');
            return;
        }
        setStatus('sending');
        setMessage('');
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, contact }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || '提交失败');
            }
            setStatus('success');
            setMessage('感谢反馈，我们会尽快联系你。');
            setContent('');
            setContact('');
        } catch (error) {
            setStatus('error');
            setMessage(error instanceof Error ? error.message : '提交失败');
        }
    };

    return (
        <>
            <button
                type="button"
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={() => {
                    if (skipOpenRef.current) {
                        skipOpenRef.current = false;
                        return;
                    }
                    setOpen(true);
                }}
                style={desktopPosition ? { left: desktopPosition.x, top: desktopPosition.y } : undefined}
                className={clsx(
                    'fixed z-40 hidden cursor-grab touch-none select-none items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-gray-400 active:cursor-grabbing md:flex',
                    desktopPosition ? '' : 'right-3 top-1/2 -translate-y-1/2'
                )}
                title="点击提交反馈，拖动调整位置"
            >
                <Sparkles size={16} />
                反馈
            </button>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed right-4 bottom-4 z-40 md:hidden flex items-center justify-center w-12 h-12 rounded-full bg-black text-white shadow-lg"
            >
                <Sparkles size={18} />
            </button>

            <div
                className={clsx(
                    'fixed inset-0 z-50 transition',
                    open ? 'pointer-events-auto' : 'pointer-events-none'
                )}
            >
                <div
                    className={clsx(
                        'absolute inset-0 bg-black/40 transition-opacity',
                        open ? 'opacity-100' : 'opacity-0'
                    )}
                    onClick={() => setOpen(false)}
                />
                <aside
                    className={clsx(
                        'absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl transition-transform',
                        open ? 'translate-x-0' : 'translate-x-full'
                    )}
                >
                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                        <h2 className="text-lg font-semibold text-gray-900">反馈</h2>
                        <button
                            type="button"
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => setOpen(false)}
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-500">
                            你的每条反馈都会直接进入改进清单，我们会优先优化最有价值的体验。
                        </p>
                        <div>
                            <label className="text-sm text-gray-700">最希望改进的地方</label>
                            <textarea
                                className="mt-2 w-full border rounded-lg px-3 py-2 min-h-[140px]"
                                placeholder="例如：某个功能用起来不顺手、你最想要的一个新功能..."
                                value={content}
                                onChange={event => setContent(event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-700">联系方式（可选）</label>
                            <input
                                className="mt-2 w-full border rounded-lg px-3 py-2"
                                placeholder="邮箱或手机号"
                                value={contact}
                                onChange={event => setContact(event.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            className="w-full bg-gray-900 text-white rounded-lg px-5 py-2 text-sm font-semibold"
                            onClick={submit}
                            disabled={status === 'sending'}
                        >
                            {status === 'sending' ? '提交中…' : '提交反馈'}
                        </button>
                        {message ? (
                            <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                                {message}
                            </p>
                        ) : null}
                    </div>
                </aside>
            </div>
        </>
    );
}
