import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Loader2, MailPlus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { searchApi, messagesApi } from '../api';

const NewMessageModal = ({ open, onClose }) => {
  const { lang } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) { setQ(''); setResults([]); setError(''); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchApi.users(term)
        .then((rows) => setResults(rows || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  const start = async (username) => {
    setStarting(username);
    setError('');
    try {
      const conv = await messagesApi.start(username);
      onClose();
      nav(`/messages/${conv.id}`);
    } catch (e) {
      setError(lang === 'ar' ? 'تعذر بدء المحادثة.' : 'Could not start conversation.');
    } finally {
      setStarting('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 sm:p-12" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-[#0a100d] border border-zinc-800 rounded-2xl shadow-2xl shadow-green-900/20 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
          <h2 className="font-extrabold text-lg flex items-center gap-2"><MailPlus size={20} className="text-green-500" /> {lang === 'ar' ? 'رسالة جديدة' : 'New message'}</h2>
          <button data-testid="close-new-message-btn" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5"><X size={20} /></button>
        </header>

        <div className="p-4">
          <div className="relative">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 start-3 text-zinc-500" />
            <input
              data-testid="search-user-input"
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث باسم أو معرّف...' : 'Search by name or @handle...'}
              className="w-full bg-zinc-900 rounded-full ps-10 pe-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

          <div className="mt-3 max-h-[55vh] overflow-y-auto">
            {searching && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-green-500" size={20} /></div>}
            {!searching && q.trim().length >= 2 && results.length === 0 && (
              <p className="text-center text-zinc-500 py-6 text-sm">{lang === 'ar' ? 'لا توجد نتائج' : 'No results'}</p>
            )}
            {!searching && q.trim().length < 2 && (
              <p className="text-center text-zinc-600 py-6 text-sm">{lang === 'ar' ? 'اكتب على الأقل حرفين للبحث.' : 'Type at least 2 characters.'}</p>
            )}
            <ul className="space-y-1">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    data-testid={`pick-user-${u.username}`}
                    onClick={() => start(u.username)}
                    disabled={starting === u.username}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 text-start disabled:opacity-50"
                  >
                    <img src={u.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{u.name}</p>
                      <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
                    </div>
                    {starting === u.username && <Loader2 size={16} className="animate-spin text-green-500" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewMessageModal;
