import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import { useApp } from '../contexts/AppContext';
import { searchApi, tweetsApi } from '../api';
import { t } from '../i18n';
import { Search, Settings, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Explore = () => {
  const { lang } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [tweets, setTweets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('top');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        if (q.trim()) {
          const [twResp, uResp] = await Promise.all([searchApi.tweets(q), searchApi.users(q)]);
          setTweets(twResp);
          setUsers(uResp);
        } else {
          const tw = await tweetsApi.feed('trending');
          setTweets(tw);
          setUsers([]);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    const handle = setTimeout(run, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative flex-1">
            <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-zinc-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, 'search')}
              className={`w-full bg-[#0c1410] border border-transparent focus:border-green-600 focus:bg-black rounded-full py-2.5 ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm outline-none transition-colors`} />
          </div>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors"><Settings size={20} /></button>
        </div>
        {q.trim() && (
          <div className="flex border-t border-zinc-900">
            {['top', 'people'].map((k) => (
              <button key={k} onClick={() => setTab(k)} className="flex-1 py-3 text-sm font-semibold hover:bg-white/5 transition-colors relative">
                <span className={tab === k ? 'text-white' : 'text-zinc-500'}>
                  {k === 'top' ? (lang === 'ar' ? 'تغريدات' : 'Top') : (lang === 'ar' ? 'أشخاص' : 'People')}
                </span>
                {tab === k && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-green-500 rounded-full" />}
              </button>
            ))}
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-500" /></div>
      ) : tab === 'people' && q.trim() ? (
        users.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">{lang === 'ar' ? 'لا يوجد أشخاص' : 'No people found'}</div>
        ) : users.map((u) => (
          <div key={u.id} onClick={() => nav(`/u/${u.username}`)} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-zinc-900 cursor-pointer transition-colors">
            <img src={u.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-12 h-12 rounded-full object-cover bg-zinc-800" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{u.name}</p>
              <p className="text-zinc-500 text-sm truncate">@{u.username}</p>
              {u.bio && <p className="text-zinc-400 text-sm mt-0.5 truncate">{u.bio}</p>}
            </div>
          </div>
        ))
      ) : (
        tweets.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">{lang === 'ar' ? 'لا توجد نتائج' : 'No results'}</div>
        ) : tweets.map((tw) => <Tweet key={tw.id} tweet={tw} />)
      )}
    </Layout>
  );
};

export default Explore;
