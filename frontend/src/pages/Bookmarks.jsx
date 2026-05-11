import React from 'react';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { Bookmark as BookmarkIcon } from 'lucide-react';

const Bookmarks = () => {
  const { lang } = useApp();
  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-3">
        <h1 className="text-xl font-extrabold">{t(lang, 'bookmarks')}</h1>
      </header>
      <div className="text-center py-20 px-6">
        <BookmarkIcon size={48} className="mx-auto text-zinc-700 mb-4" />
        <h2 className="text-2xl font-extrabold mb-2">
          {lang === 'ar' ? 'العلامات المرجعية قريباً' : 'Bookmarks coming soon'}
        </h2>
        <p className="text-zinc-500">
          {lang === 'ar' ? 'احفظ التغريدات المفضلة لديك لاحقاً.' : 'Save posts to read later.'}
        </p>
      </div>
    </Layout>
  );
};

export default Bookmarks;
