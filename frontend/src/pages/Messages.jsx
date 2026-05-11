import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { messages as mockMsgs } from '../mock';
import { t } from '../i18n';
import { Settings, Send, Mail } from 'lucide-react';

const Messages = () => {
  const { lang, getUserById } = useApp();
  const [active, setActive] = useState(mockMsgs[0]);
  const [chat, setChat] = useState([
    { from: 'them', text: 'مرحباً! كيف حالك؟', time: '10:30' },
    { from: 'me', text: 'بخير والحمد لله تمام، وانت؟', time: '10:31' },
    { from: 'them', text: 'ممتاز! تمام، نتقابل بكرا الساعة 5', time: '10:32' },
  ]);
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    setChat((c) => [...c, { from: 'me', text: draft, time: 'now' }]);
    setDraft('');
  };

  return (
    <Layout>
      <div className="grid grid-cols-[1fr] md:grid-cols-[320px_1fr] h-screen">
        {/* List */}
        <div className="border-e border-zinc-900">
          <header className="sticky top-0 bg-black/70 backdrop-blur-md border-b border-zinc-900">
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="text-xl font-extrabold">{t(lang, 'messages')}</h1>
              <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
                <Settings size={20} />
              </button>
            </div>
          </header>
          <div>
            {mockMsgs.map((m) => {
              const u = getUserById(m.userId);
              return (
                <button
                  key={m.id}
                  onClick={() => setActive(m)}
                  className={`w-full text-start flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${active?.id === m.id ? 'bg-white/5' : ''}`}
                >
                  <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm truncate">{u.name}</p>
                      <p className="text-xs text-zinc-500">{m.time}</p>
                    </div>
                    <p className={`text-sm truncate ${m.unread ? 'text-white font-semibold' : 'text-zinc-500'}`}>{m.lastMessage}</p>
                  </div>
                  {m.unread && <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat */}
        <div className="hidden md:flex flex-col h-screen">
          {active ? (
            <>
              <header className="sticky top-0 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex items-center gap-3">
                <img src={getUserById(active.userId).avatar} className="w-9 h-9 rounded-full object-cover" />
                <div>
                  <p className="font-bold text-sm">{getUserById(active.userId).name}</p>
                  <p className="text-xs text-zinc-500">@{getUserById(active.userId).username}</p>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chat.map((c, i) => (
                  <div key={i} className={`flex ${c.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-[15px] ${c.from === 'me' ? 'bg-green-600 text-white rounded-br-sm' : 'bg-[#0c1410] border border-zinc-900 rounded-bl-sm'}`}>
                      <p>{c.text}</p>
                      <p className="text-[10px] opacity-60 mt-1 text-end">{c.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-900 p-3 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={t(lang, 'typeMessage')}
                  className="flex-1 bg-[#0c1410] border border-zinc-900 focus:border-green-600 rounded-full px-4 py-2.5 outline-none text-sm transition-colors"
                />
                <button onClick={send} className="p-3 rounded-full btn-primary">
                  <Send size={18} className="flip-rtl" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
              <Mail size={48} className="mb-3" />
              <p>{t(lang, 'newMessage')}</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Messages;
