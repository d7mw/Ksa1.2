import React from 'react';
import { MessageCircle, Repeat2, Heart, BarChart3, Share, MoreHorizontal, Bookmark, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';

const formatNum = (n) => {
  if (!n) return 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n;
};

const timeAgo = (iso, lang) => {
  if (!iso) return '';
  const date = new Date(iso);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return lang === 'ar' ? 'الآن' : 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return lang === 'ar' ? `منذ ${min} د` : `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return lang === 'ar' ? `منذ ${h} س` : `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return lang === 'ar' ? `منذ ${d} ي` : `${d}d`;
  return date.toLocaleDateString();
};

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 inline-block verified-badge fill-current flex-shrink-0">
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);

const Tweet = ({ tweet, onDelete }) => {
  const { lang, user, toggleLike, toggleRetweet, deleteTweet } = useApp();
  const nav = useNavigate();
  const author = tweet.author || {};
  const canDelete = user && (user.id === tweet.user_id || user.is_admin);

  const handleClick = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    nav(`/tweet/${tweet.id}`);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(lang === 'ar' ? 'حذف التغريدة؟' : 'Delete this post?')) return;
    try {
      await deleteTweet(tweet.id);
      onDelete?.(tweet.id);
    } catch (e) { console.error(e); }
  };

  return (
    <article onClick={handleClick} className="tweet-card fade-in px-4 py-3 border-b border-zinc-900 cursor-pointer flex gap-3">
      <img
        src={author.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'}
        alt={author.name}
        className="w-11 h-11 rounded-full object-cover flex-shrink-0 bg-zinc-800"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-[15px]">
          <span className="font-bold hover:underline truncate">{author.name}</span>
          {author.verified && <VerifiedIcon />}
          <span className="text-zinc-500 truncate">@{author.username}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500 hover:underline">{timeAgo(tweet.created_at, lang)}</span>
          <div className="ms-auto flex items-center">
            {canDelete && (
              <button onClick={handleDelete} className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors">
                <Trash2 size={16} className="text-zinc-500" />
              </button>
            )}
            <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
              <MoreHorizontal size={16} className="text-zinc-500" />
            </button>
          </div>
        </div>

        <p className="text-[15px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words mt-0.5">
          {tweet.content}
        </p>

        {tweet.image && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-900">
            <img src={tweet.image} alt="" className="w-full max-h-[500px] object-cover" />
          </div>
        )}

        <div className="flex items-center justify-between mt-3 max-w-md text-zinc-500">
          <button
            onClick={(e) => { e.stopPropagation(); nav(`/tweet/${tweet.id}`); }}
            className="icon-btn icon-reply flex items-center gap-2 text-sm"
          >
            <MessageCircle size={18} />
            <span>{formatNum(tweet.replies_count)}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleRetweet(tweet.id); }}
            className={`icon-btn icon-retweet flex items-center gap-2 text-sm ${tweet.retweeted ? 'text-green-500' : ''}`}
          >
            <Repeat2 size={20} />
            <span>{formatNum(tweet.retweets_count)}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike(tweet.id); }}
            className={`icon-btn icon-like flex items-center gap-2 text-sm ${tweet.liked ? 'text-pink-500' : ''}`}
          >
            <Heart size={18} fill={tweet.liked ? 'currentColor' : 'none'} />
            <span>{formatNum(tweet.likes_count)}</span>
          </button>
          <button onClick={(e) => e.stopPropagation()} className="icon-btn icon-share flex items-center gap-2 text-sm">
            <BarChart3 size={18} />
            <span>{formatNum(tweet.views)}</span>
          </button>
          <button onClick={(e) => e.stopPropagation()} className="icon-btn icon-share"><Bookmark size={18} /></button>
          <button onClick={(e) => e.stopPropagation()} className="icon-btn icon-share"><Share size={18} /></button>
        </div>
      </div>
    </article>
  );
};

export default Tweet;
