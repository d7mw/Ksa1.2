import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import ComposeTweet from '../components/ComposeTweet';
import { useApp } from '../contexts/AppContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { t } from '../i18n';
import { tweetsApi } from '../api';

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 inline-block verified-badge fill-current"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" /></svg>
);

const TweetDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { lang } = useApp();
  const [tweet, setTweet] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([tweetsApi.get(id), tweetsApi.replies(id)])
      .then(([tw, r]) => { if (mounted) { setTweet(tw); setReplies(r); } })
      .catch(() => mounted && setTweet(null))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [id]);

  const onReplyPosted = (r) => setReplies((arr) => [r, ...arr]);

  if (loading) return <Layout><div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-500" /></div></Layout>;
  if (!tweet) return <Layout><div className="text-center py-20 text-zinc-500">{lang === 'ar' ? 'غير موجودة' : 'Not found'}</div></Layout>;

  const author = tweet.author || {};

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex items-center gap-4">
        <button onClick={() => nav(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors"><ArrowLeft size={20} className="flip-rtl" /></button>
        <h1 className="text-lg font-extrabold">{lang === 'ar' ? 'تغريدة' : 'Post'}</h1>
      </header>

      <article className="px-4 py-4 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <Link to={author.username ? `/u/${author.username}` : '#'}>
            <img src={author.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-12 h-12 rounded-full object-cover bg-zinc-800 hover:opacity-90 transition-opacity" />
          </Link>
          <div>
            <Link to={author.username ? `/u/${author.username}` : '#'} className="font-bold flex items-center gap-1 hover:underline">
              {author.name} {author.verified && <VerifiedIcon />}
            </Link>
            <Link to={author.username ? `/u/${author.username}` : '#'} className="text-zinc-500 text-sm hover:underline block">@{author.username}</Link>
          </div>
        </div>
        <p className="text-[22px] leading-relaxed mt-3 whitespace-pre-wrap break-words">{tweet.content}</p>
        {tweet.image && <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-900"><img src={tweet.image} alt="" className="w-full max-h-[600px] object-cover" /></div>}
        <p className="text-zinc-500 text-sm mt-3">{new Date(tweet.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} · {tweet.views?.toLocaleString() || 0} {t(lang, 'views')}</p>
        <div className="flex gap-5 mt-3 pt-3 border-t border-zinc-900 text-sm text-zinc-500">
          <span><b className="text-white">{tweet.replies_count}</b> {t(lang, 'replies')}</span>
          <span><b className="text-white">{tweet.retweets_count}</b> {t(lang, 'retweet')}</span>
          <span><b className="text-white">{tweet.likes_count}</b> {t(lang, 'likes')}</span>
        </div>
      </article>

      <ComposeTweet parentId={tweet.id} placeholder={lang === 'ar' ? 'اكتب ردك...' : 'Post your reply...'} onPosted={onReplyPosted} />

      <div>
        {replies.map((r) => <Tweet key={r.id} tweet={r} />)}
      </div>
    </Layout>
  );
};

export default TweetDetail;
