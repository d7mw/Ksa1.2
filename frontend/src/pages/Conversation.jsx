import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { messagesApi } from '../api';
import { compressImage } from '../utils/imageCompress';
import { timeAgo } from '../utils/dates';
import { ArrowLeft, Send, ImagePlus, Paperclip, X, Loader2, Lock, BadgeCheck } from 'lucide-react';

const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024;

const Conversation = () => {
  const { conversationId } = useParams();
  const { lang, user } = useApp();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const fileImgRef = useRef(null);
  const fileAnyRef = useRef(null);
  const bottomRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const d = await messagesApi.get(conversationId);
      setData(d);
      // mark as read on every load
      messagesApi.markRead(conversationId).catch(() => {});
    } catch {
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(true); }, 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [data?.messages?.length]);

  const onPickImage = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files.slice(0, 4 - attachments.length)) {
      try {
        const dataUrl = await compressImage(f, { maxDimension: 1600 });
        setAttachments((cur) => [...cur, { type: 'image', url: dataUrl, name: f.name, size: dataUrl.length, mime: 'image/jpeg' }]);
      } catch {
        setError(lang === 'ar' ? 'تعذر معالجة الصورة' : 'Could not process image');
      }
    }
  };

  const onPickFile = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files.slice(0, 4 - attachments.length)) {
      if (f.size > MAX_ATTACHMENT_SIZE) {
        setError(lang === 'ar' ? 'الملف كبير جداً (الحد 4 ميجابايت)' : 'File too large (max 4MB)');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((cur) => [...cur, { type: 'file', url: reader.result, name: f.name, size: f.size, mime: f.type }]);
      };
      reader.readAsDataURL(f);
    }
  };

  const send = async () => {
    if (sending) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    setSending(true);
    setError('');
    try {
      const msg = await messagesApi.send(conversationId, { content: trimmed, attachments });
      setData((d) => d ? { ...d, messages: [...d.messages, msg] } : d);
      setText('');
      setAttachments([]);
    } catch (e) {
      const code = e?.response?.data?.detail;
      if (code === 'dm_restricted_to_followers') {
        setError(lang === 'ar' ? 'هذا المستخدم يستقبل الرسائل من المتابعين فقط.' : 'This user only accepts messages from followers.');
      } else if (code === 'attachment_too_large' || code === 'message_too_large') {
        setError(lang === 'ar' ? 'حجم الرسالة كبير جداً.' : 'Message is too large.');
      } else {
        setError(lang === 'ar' ? 'تعذر إرسال الرسالة.' : 'Failed to send message.');
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Layout><div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="animate-spin text-green-500" size={28} /></div></Layout>;
  }
  if (!data) {
    return <Layout><div className="text-center py-24 text-zinc-500">{lang === 'ar' ? 'المحادثة غير موجودة' : 'Conversation not found'}</div></Layout>;
  }

  const peer = data.peer;

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-3 py-2 flex items-center gap-3">
        <button data-testid="conv-back-btn" onClick={() => nav('/messages')} className="p-2 rounded-full hover:bg-white/5"><ArrowLeft size={20} className="flip-rtl" /></button>
        {peer && (
          <button onClick={() => nav(`/${peer.username}`)} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80">
            <img src={peer.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
            <div className="text-start min-w-0">
              <p data-testid="conv-peer-name" className="font-bold text-[15px] truncate flex items-center gap-1">
                {peer.name}
                {peer.verified && <BadgeCheck size={14} className="verified-badge fill-current" />}
              </p>
              <p className="text-xs text-zinc-500 truncate">@{peer.username}</p>
            </div>
          </button>
        )}
      </header>

      <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="flex-1 px-3 py-4 space-y-2">
          {data.messages.length === 0 && (
            <p className="text-center text-zinc-500 py-12 text-sm">
              {lang === 'ar' ? 'لا توجد رسائل بعد. ابدأ بكتابة شيء.' : 'No messages yet. Say hi.'}
            </p>
          )}
          {data.messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} data-testid={`msg-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-100'}`}>
                  {m.content && <p className="whitespace-pre-wrap break-words text-[15px]">{m.content}</p>}
                  {(m.attachments || []).map((a, i) => (
                    a.type === 'image' ? (
                      <img key={i} src={a.url} alt="" className="mt-1 max-h-72 rounded-xl object-cover" />
                    ) : (
                      <a key={i} href={a.url} download={a.name} className={`mt-1 flex items-center gap-2 text-sm underline ${mine ? 'text-white' : 'text-green-400'}`}>
                        <Paperclip size={14} /> <span className="truncate max-w-[200px]">{a.name || (lang === 'ar' ? 'ملف' : 'file')}</span>
                      </a>
                    )
                  ))}
                  <p className={`text-[10px] mt-1 ${mine ? 'text-green-100/80' : 'text-zinc-500'} text-end`}>{timeAgo(m.created_at, lang)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {!data.can_send ? (
          <div className="sticky bottom-0 bg-black/95 backdrop-blur border-t border-zinc-900 p-4 text-center">
            <Lock size={20} className="mx-auto text-zinc-500 mb-1" />
            <p className="text-sm text-zinc-400">
              {data.block_reason === 'dm_restricted_to_followers'
                ? (lang === 'ar' ? 'هذا الحساب يستقبل الرسائل من المتابعين فقط.' : 'This account only accepts messages from people it follows.')
                : (lang === 'ar' ? 'لا يمكن إرسال الرسائل في هذه المحادثة.' : 'You cannot send messages in this conversation.')}
            </p>
          </div>
        ) : (
          <div className="sticky bottom-0 bg-black/95 backdrop-blur border-t border-zinc-900 p-3">
            {attachments.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto">
                {attachments.map((a, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    {a.type === 'image' ? (
                      <img src={a.url} alt="" className="h-16 w-16 object-cover rounded-lg" />
                    ) : (
                      <div className="h-16 w-24 flex items-center justify-center bg-zinc-800 rounded-lg text-[10px] text-zinc-400 px-1 truncate">
                        <Paperclip size={14} className="mr-1" />{a.name?.slice(0, 10) || 'file'}
                      </div>
                    )}
                    <button onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))} className="absolute -top-1 -end-1 bg-black/80 rounded-full p-0.5"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {error && <p data-testid="conv-error" className="text-xs text-red-400 mb-1.5">{error}</p>}
            <div className="flex items-end gap-2">
              <button data-testid="attach-image-btn" onClick={() => fileImgRef.current?.click()} className="p-2 rounded-full text-green-500 hover:bg-green-500/10"><ImagePlus size={20} /></button>
              <button data-testid="attach-file-btn" onClick={() => fileAnyRef.current?.click()} className="p-2 rounded-full text-green-500 hover:bg-green-500/10"><Paperclip size={20} /></button>
              <input ref={fileImgRef} type="file" accept="image/*" multiple onChange={onPickImage} hidden />
              <input ref={fileAnyRef} type="file" onChange={onPickFile} hidden />
              <textarea
                data-testid="message-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder={lang === 'ar' ? 'اكتب رسالة...' : 'Start a new message'}
                className="flex-1 bg-zinc-900 rounded-2xl px-4 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-1 focus:ring-green-500 max-h-32"
              />
              <button
                data-testid="send-message-btn"
                onClick={send}
                disabled={sending || (!text.trim() && attachments.length === 0)}
                className="p-2.5 rounded-full bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700"
                aria-label="Send"
              >
                {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="flip-rtl" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Conversation;
