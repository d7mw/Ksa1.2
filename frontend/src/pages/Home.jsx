import React, { useState } from 'react';
import Layout from '../components/Layout';
import ComposeTweet from '../components/ComposeTweet';
import Tweet from '../components/Tweet';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { Sparkles } from 'lucide-react';

const Home = () => {
  const { lang, tweets, followingIds } = useApp();
  const [tab, setTab] = useState('forYou');

  const filtered = tab === 'following'
    ? tweets.filter((tw) => followingIds.includes(tw.userId) || tw.isMe)
    : tweets;

  return (
    <Layout>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-extrabold">{t(lang, 'home')}</h1>
          <Sparkles size={20} className="text-green-500" />
        </div>
        <div className="flex">
          {['forYou', 'following'].map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="flex-1 py-3.5 text-sm font-semibold hover:bg-white/5 transition-colors relative"
            >
              <span className={tab === k ? 'text-white' : 'text-zinc-500'}>{t(lang, k)}</span>
              {tab === k && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-green-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      <ComposeTweet />

      <div>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-zinc-500">
            {lang === 'ar' ? 'لا توجد تغريدات بعد.' : 'No tweets yet.'}
          </div>
        )}
        {filtered.map((tw) => (
          <Tweet key={tw.id} tweet={tw} />
        ))}
      </div>
    </Layout>
  );
};

export default Home;
