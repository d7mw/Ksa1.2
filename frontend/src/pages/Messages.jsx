import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import NewMessageModal from '../components/NewMessageModal';
import { useApp } from '../contexts/AppContext';
import { messagesApi } from '../api';
import { timeAgo } from '../utils/dates';
import { Mail, MailPlus, Loader2 } from 'lucide-react';

const Messages = () => {
  const { lang, user } = useApp();
  const nav = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);

  const load = useCallback(() => {
    messagesApi.conversations()
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(); }, 8000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 data-testid="messages-title" className="text-xl font-extrabold">
            {lang === 'ar' ? 'الرسائل' : 'Messages'}
          </h1>
          <button
            data-testid="open-new-message-btn"
            onClick={() => setComposeOpen(true)}
            className="p-2 rounded-full hover:bg-white/5 transition-colors text-green-500"
            aria-label={lang === 'ar' ? 'رسالة جديدة' : 'New message'}
          >
            <MailPlus size={22} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-green-500" size={28} />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-24 px-6">
          <Mail size={56} className="mx-auto text-zinc-700 mb-4" />
          <h2 className="text-2xl font-extrabold mb-3">
            {lang === 'ar' ? 'لا توجد محادثات بعد' : 'No messages yet'}
          </h2>
          <p className="text-zinc-500 max-w-md mx-auto mb-6">
            {lang === 'ar'
              ? 'ابدأ محادثة مع أي شخص من خلال زر الرسالة الجديدة في الأعلى.'
              : 'Start a conversation by tapping the new message icon above.'}
          </p>
          <button
            data-testid="empty-new-message-btn"
            onClick={() => setComposeOpen(true)}
            className="btn-primary px-5 py-2 rounded-full font-bold inline-flex items-center gap-2"
          >
            <MailPlus size={18} />
            {lang === 'ar' ? 'رسالة جديدة' : 'New message'}
          </button>
        </div>
      ) : (
        <ul data-testid="conversation-list">
          {conversations.map((c) => (
            <li
              key={c.id}
              data-testid={`conv-row-${c.id}`}
              onClick={() => nav(`/messages/${c.id}`)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-zinc-900 transition-colors"
            >
              <img
                src={c.peer?.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 48 48\'><rect width=\'48\' height=\'48\' fill=\'%231f2a24\'/></svg>'}
                alt=""
                className="w-12 h-12 rounded-full object-cover bg-zinc-800 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-bold text-[15px] truncate">{c.peer?.name || (lang === 'ar' ? 'مستخدم' : 'User')}</p>
                  {c.last_message_at && (
                    <span className="text-xs text-zinc-500 flex-shrink-0">{timeAgo(c.last_message_at, lang)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-zinc-500 truncate">
                    {c.last_sender_id === user?.id && c.last_message_preview ? (lang === 'ar' ? 'أنت: ' : 'You: ') : ''}
                    {c.last_message_preview || (lang === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet')}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-green-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {c.unread_count > 99 ? '99+' : c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewMessageModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </Layout>
  );
};

export default Messages;
