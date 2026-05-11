import React, { useState } from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import ComposeTweet from '../components/ComposeTweet';
import { useApp } from '../contexts/AppContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { t } from '../i18n';

const TweetDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { lang, tweets, getUserById } = useApp();
  const tweet = tweets.find((t) => t.id === id);
  const [replies, setReplies] = useState([]);
  const [draft, setDraft] = useState('');

  if (!tweet) {
    return (
      <Layout>
        <div className="text-center py-20 text-zinc-500">{lang === 'ar' ? 'التغريدة غير موجودة' : 'Tweet not found'}</div>
      </Layout>
    );
  }

  const author = getUserById(tweet.userId);

  const reply = () => {
    if (!draft.trim()) return;
    setReplies((r) => [{ id: Date.now(), text: draft, time: lang === 'ar' ? 'الآن' : 'now' }, ...r]);
    setDraft('');
  };

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex items-center gap-4">
        <button onClick={() => nav(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} className="flip-rtl" />
        </button>
        <h1 className="text-lg font-extrabold">{lang === 'ar' ? 'تغريدة' : 'Post'}</h1>
      </header>

      <article className="px-4 py-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <img src={author.avatar} className="w-12 h-12 rounded-full object-cover" />
          <div>
            <p className="font-bold">{author.name}</p>
            <p className="text-zinc-500 text-sm">@{author.username}</p>
          </div>
        </div>
        <p className="text-[22px] leading-relaxed mt-3 whitespace-pre-wrap">{tweet.content}</p>
        {tweet.image && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-900">
            <img src={tweet.image} className="w-full max-h-[600px] object-cover" />
          </div>
        )}
        <p className="text-zinc-500 text-sm mt-3">{tweet.timestamp} · {tweet.views.toLocaleString()} {t(lang, 'views')}</p>
      </article>

      <div className="px-4 py-3 border-b border-zinc-900 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && reply()}
          placeholder={lang === 'ar' ? 'اكتب ردك...' : 'Write your reply...'}
          className="flex-1 bg-[#0c1410] border border-zinc-900 focus:border-green-600 rounded-full px-4 py-2.5 outline-none text-sm transition-colors"
        />
        <button onClick={reply} className="btn-primary px-5 rounded-full font-bold text-sm">{t(lang, 'reply')}</button>
      </div>

      {replies.map((r) => (
        <div key={r.id} className="px-4 py-3 border-b border-zinc-900">
          <p className="text-sm text-zinc-400"><span className="font-bold text-zinc-100">{lang === 'ar' ? 'أنت' : 'You'}</span> · {r.time}</p>
          <p className="mt-1">{r.text}</p>
        </div>
      ))}
    </Layout>
  );
};

export default TweetDetail;
