import React, { useState } from 'react';
import Layout from '../components/Layout';
import ComposeTweet from '../components/ComposeTweet';
import Tweet from '../components/Tweet';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { Sparkles, Loader2 } from 'lucide-react';

const Home = () => {
  const { lang, tweets, tweetsLoading, feedTab, setFeedTab } = useApp();
  const [tab, setTab] = useState(feedTab);

  const setActive = (k) => { setTab(k); setFeedTab(k); };

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-extrabold">{t(lang, 'home')}</h1>
          <Sparkles size={20} className="text-green-500" />
        </div>
        <div className="flex">
          {['forYou', 'following'].map((k) => (
            <button key={k} onClick={() => setActive(k)} className="flex-1 py-3.5 text-sm font-semibold hover:bg-white/5 transition-colors relative">
              <span className={tab === k ? 'text-white' : 'text-zinc-500'}>{t(lang, k)}</span>
              {tab === k && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-green-500 rounded-full" />}
            </button>
          ))}
        </div>
      </header>

      <ComposeTweet />

      <div>
        {tweetsLoading && (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-500" /></div>
        )}
        {!tweetsLoading && tweets.length === 0 && (
          <div className="text-center py-16 px-6">
            <p className="text-zinc-500 text-lg">
              {lang === 'ar' ? 'لا توجد تغريدات بعد.' : 'No posts yet.'}
            </p>
            <p className="text-zinc-600 text-sm mt-2">
              {lang === 'ar' ? 'ابدأ بكتابة أول تغريدة!' : 'Be the first to post!'}
            </p>
          </div>
        )}
        {tweets.map((tw) => <Tweet key={tw.id} tweet={tw} />)}
      </div>
    </Layout>
  );
};

export default Home;
