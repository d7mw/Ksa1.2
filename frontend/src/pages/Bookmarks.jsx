import React from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { Bookmark as BookmarkIcon } from 'lucide-react';

const Bookmarks = () => {
  const { lang, tweets } = useApp();
  const saved = tweets.filter((t) => t.liked).slice(0, 3);

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-3">
        <h1 className="text-xl font-extrabold">{t(lang, 'bookmarks')}</h1>
        <p className="text-xs text-zinc-500">@you</p>
      </header>
      {saved.length === 0 ? (
        <div className="text-center py-20 px-6">
          <BookmarkIcon size={48} className="mx-auto text-zinc-700 mb-4" />
          <h2 className="text-2xl font-extrabold mb-2">{lang === 'ar' ? 'احفظ التغريدات لوقت لاحق' : 'Save posts for later'}</h2>
          <p className="text-zinc-500">{lang === 'ar' ? 'العلامات المرجعية تساعدك في الرجوع للتغريدات المفضلة.' : 'Your saved posts will live here.'}</p>
        </div>
      ) : (
        saved.map((tw) => <Tweet key={tw.id} tweet={tw} />)
      )}
    </Layout>
  );
};

export default Bookmarks;
