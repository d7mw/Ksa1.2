import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { Settings, Send, Mail } from 'lucide-react';

// Messages page - UI only, real messaging requires more backend work.
// Marked clearly as a coming-soon feature.
const Messages = () => {
  const { lang } = useApp();

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-extrabold">{t(lang, 'messages')}</h1>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors"><Settings size={20} /></button>
        </div>
      </header>
      <div className="text-center py-24 px-6">
        <Mail size={56} className="mx-auto text-zinc-700 mb-4" />
        <h2 className="text-3xl font-extrabold mb-3">
          {lang === 'ar' ? 'الرسائل قريباً' : 'Messages coming soon'}
        </h2>
        <p className="text-zinc-500 max-w-md mx-auto">
          {lang === 'ar'
            ? 'نعمل على إطلاق الرسائل الخاصة بين المستخدمين. ترقبوا التحديث!'
            : 'Direct messages between users are coming soon. Stay tuned!'}
        </p>
      </div>
    </Layout>
  );
};

export default Messages;
