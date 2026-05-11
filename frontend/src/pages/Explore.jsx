import React, { useState } from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import { useApp } from '../contexts/AppContext';
import { trends } from '../mock';
import { t } from '../i18n';
import { Search, Settings } from 'lucide-react';

const tabs = ['forYou', 'trending', 'news', 'sports'];

const Explore = () => {
  const { lang, tweets } = useApp();
  const [active, setActive] = useState('forYou');
  const [q, setQ] = useState('');

  const filtered = q.trim()
    ? tweets.filter((tw) => tw.content.toLowerCase().includes(q.toLowerCase()))
    : tweets.slice().sort((a, b) => b.likes - a.likes);

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative flex-1">
            <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-zinc-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t(lang, 'search')}
              className={`w-full bg-[#0c1410] border border-transparent focus:border-green-600 focus:bg-black rounded-full py-2.5 ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm outline-none transition-colors`}
            />
          </div>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <Settings size={20} />
          </button>
        </div>
        <div className="flex overflow-x-auto">
          {tabs.map((k) => (
            <button
              key={k}
              onClick={() => setActive(k)}
              className="px-5 py-3 text-sm font-semibold whitespace-nowrap hover:bg-white/5 transition-colors relative"
            >
              <span className={active === k ? 'text-white' : 'text-zinc-500'}>
                {k === 'forYou' ? t(lang, 'forYou') : k === 'trending' ? (lang === 'ar' ? 'الأكثر تداولاً' : 'Trending') : k === 'news' ? (lang === 'ar' ? 'أخبار' : 'News') : (lang === 'ar' ? 'رياضة' : 'Sports')}
              </span>
              {active === k && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-green-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Trends block */}
      <div className="border-b border-zinc-900">
        <h2 className="text-xl font-extrabold px-4 pt-4 pb-2">{t(lang, 'trendsForYou')}</h2>
        {trends.map((tr, i) => (
          <div key={i} className="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors">
            <p className="text-xs text-zinc-500">{i + 1} · {tr.category}</p>
            <p className="font-bold text-[15px]">{tr.tag}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{tr.posts}</p>
          </div>
        ))}
      </div>

      {/* Search results */}
      <div>
        {filtered.map((tw) => (
          <Tweet key={tw.id} tweet={tw} />
        ))}
      </div>
    </Layout>
  );
};

export default Explore;
