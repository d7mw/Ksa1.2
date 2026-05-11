import React from 'react';
import { MessageCircle, Repeat2, Heart, BarChart3, Share, MoreHorizontal, Bookmark } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';

const formatNum = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n;
};

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 inline-block verified-badge fill-current">
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);

const Tweet = ({ tweet }) => {
  const { getUserById, toggleLike, toggleRetweet } = useApp();
  const nav = useNavigate();
  const author = getUserById(tweet.userId);

  const handleClick = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    nav(`/tweet/${tweet.id}`);
  };

  return (
    <article
      onClick={handleClick}
      className="tweet-card fade-in px-4 py-3 border-b border-zinc-900 cursor-pointer flex gap-3"
    >
      <img src={author.avatar} alt={author.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-[15px]">
          <span className="font-bold hover:underline truncate">{author.name}</span>
          {author.verified && <VerifiedIcon />}
          <span className="text-zinc-500 truncate">@{author.username}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500 hover:underline">{tweet.timestamp}</span>
          <button className="ms-auto p-2 rounded-full hover:bg-white/5 transition-colors">
            <MoreHorizontal size={16} className="text-zinc-500" />
          </button>
        </div>

        <p className="text-[15px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words mt-0.5">
          {tweet.content}
        </p>

        {tweet.image && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-900">
            <img src={tweet.image} alt="tweet" className="w-full max-h-[500px] object-cover" />
          </div>
        )}

        <div className="flex items-center justify-between mt-3 max-w-md text-zinc-500">
          <button className="icon-btn icon-reply flex items-center gap-2 text-sm">
            <MessageCircle size={18} />
            <span>{formatNum(tweet.replies)}</span>
          </button>
          <button
            onClick={() => toggleRetweet(tweet.id)}
            className={`icon-btn icon-retweet flex items-center gap-2 text-sm ${tweet.retweeted ? 'text-green-500' : ''}`}
          >
            <Repeat2 size={20} />
            <span>{formatNum(tweet.retweets)}</span>
          </button>
          <button
            onClick={() => toggleLike(tweet.id)}
            className={`icon-btn icon-like flex items-center gap-2 text-sm ${tweet.liked ? 'text-pink-500' : ''}`}
          >
            <Heart size={18} fill={tweet.liked ? 'currentColor' : 'none'} />
            <span>{formatNum(tweet.likes)}</span>
          </button>
          <button className="icon-btn icon-share flex items-center gap-2 text-sm">
            <BarChart3 size={18} />
            <span>{formatNum(tweet.views)}</span>
          </button>
          <button className="icon-btn icon-share flex items-center gap-1 text-sm">
            <Bookmark size={18} />
          </button>
          <button className="icon-btn icon-share flex items-center gap-1 text-sm">
            <Share size={18} />
          </button>
        </div>
      </div>
    </article>
  );
};

export default Tweet;
