import React, { useState, useEffect } from 'react';
import { MessageCircle, Repeat2, Heart, BarChart3, Share, MoreHorizontal, Bookmark, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate, Link } from 'react-router-dom';
import { tweetsApi } from '../api';
import { timeAgo } from '../utils/dates';

const formatNum = (n) => {
  if (!n) return 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n;
};

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 inline-block verified-badge fill-current flex-shrink-0">
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);

const FALLBACK_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%231f2a24'/></svg>";

const Tweet = ({ tweet, onDelete, onActionDone }) => {
  const { lang, user, deleteTweet } = useApp();
  const nav = useNavigate();
  const author = tweet.author || {};
  const canDelete = user && (user.id === tweet.user_id || user.is_admin);

  // Local optimistic state for instant UI feedback
  const [liked, setLiked] = useState(!!tweet.liked);
  const [retweeted, setRetweeted] = useState(!!tweet.retweeted);
  const [likesCount, setLikesCount] = useState(tweet.likes_count || 0);
  const [retweetsCount, setRetweetsCount] = useState(tweet.retweets_count || 0);

  // Sync when tweet prop changes (e.g. after parent refetch)
  useEffect(() => {
    setLiked(!!tweet.liked);
    setRetweeted(!!tweet.retweeted);
    setLikesCount(tweet.likes_count || 0);
    setRetweetsCount(tweet.retweets_count || 0);
  }, [tweet.id, tweet.liked, tweet.retweeted, tweet.likes_count, tweet.retweets_count]);

  const handleClick = (e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    nav(`/tweet/${tweet.id}`);
  };

  const stop = (e) => e.stopPropagation();

  const handleLike = async (e) => {
    stop(e);
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      await tweetsApi.like(tweet.id);
      onActionDone?.({ type: 'like', tweetId: tweet.id, liked: next });
    } catch (err) {
      setLiked(!next);
      setLikesCount((c) => (!next ? c + 1 : Math.max(0, c - 1)));
    }
  };

  const handleRetweet = async (e) => {
    stop(e);
    const next = !retweeted;
    setRetweeted(next);
    setRetweetsCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      await tweetsApi.retweet(tweet.id);
      onActionDone?.({ type: 'retweet', tweetId: tweet.id, retweeted: next });
    } catch (err) {
      setRetweeted(!next);
      setRetweetsCount((c) => (!next ? c + 1 : Math.max(0, c - 1)));
    }
  };

  const handleDelete = async (e) => {
    stop(e);
    if (!window.confirm(lang === 'ar' ? 'حذف التغريدة؟' : 'Delete this post?')) return;
    try {
      await deleteTweet(tweet.id);
      onDelete?.(tweet.id);
      onActionDone?.({ type: 'delete', tweetId: tweet.id });
    } catch (e) { console.error(e); }
  };

  const goToProfile = (e, username) => {
    e.stopPropagation();
    if (username) nav(`/${username}`);
  };

  return (
    <article onClick={handleClick} className="tweet-card fade-in px-3 sm:px-4 py-3 border-b border-zinc-900 cursor-pointer max-w-full overflow-hidden">
      {tweet.retweeted_by && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs sm:text-sm mb-2 ps-12 sm:ps-14">
          <Repeat2 size={14} className="flex-shrink-0" />
          <Link
            to={`/${tweet.retweeted_by.username}`}
            onClick={stop}
            className="hover:underline truncate"
          >
            {user && tweet.retweeted_by.id === user.id
              ? (lang === 'ar' ? 'أنت أعدت النشر' : 'You reposted')
              : `${tweet.retweeted_by.name} ${lang === 'ar' ? 'أعاد النشر' : 'reposted'}`}
          </Link>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          to={author.username ? `/${author.username}` : '#'}
          onClick={stop}
          className="flex-shrink-0"
        >
          <img
            src={author.avatar || FALLBACK_AVATAR}
            alt={author.name}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover bg-zinc-800 hover:opacity-90 transition-opacity"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm sm:text-[15px]">
            <Link
              to={author.username ? `/${author.username}` : '#'}
              onClick={stop}
              className="font-bold hover:underline truncate"
            >
              {author.name}
            </Link>
            {author.verified && <VerifiedIcon />}
            <Link
              to={author.username ? `/${author.username}` : '#'}
              onClick={stop}
              className="text-zinc-500 truncate hidden xs:inline hover:underline"
            >
              @{author.username}
            </Link>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-500 hover:underline whitespace-nowrap">{timeAgo(tweet.created_at, lang)}</span>
            <div className="ms-auto flex items-center">
              {canDelete && (
                <button onClick={handleDelete} className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors">
                  <Trash2 size={16} className="text-zinc-500" />
                </button>
              )}
              <button onClick={stop} className="p-2 rounded-full hover:bg-white/5 transition-colors">
                <MoreHorizontal size={16} className="text-zinc-500" />
              </button>
            </div>
          </div>

          <p className="text-[15px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words mt-0.5 overflow-hidden">
            {tweet.content}
          </p>

          {tweet.image && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-900">
              <img src={tweet.image} alt="" className="w-full max-h-[500px] object-cover" />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 max-w-md text-zinc-500 -mx-2">
            <button
              onClick={(e) => { stop(e); nav(`/tweet/${tweet.id}`); }}
              className="icon-btn icon-reply flex items-center gap-2 text-sm"
            >
              <MessageCircle size={18} />
              <span>{formatNum(tweet.replies_count)}</span>
            </button>
            <button
              onClick={handleRetweet}
              className={`icon-btn icon-retweet flex items-center gap-2 text-sm ${retweeted ? 'text-green-500' : ''}`}
              aria-pressed={retweeted}
              aria-label={retweeted ? (lang === 'ar' ? 'إلغاء إعادة النشر' : 'Undo repost') : (lang === 'ar' ? 'إعادة النشر' : 'Repost')}
            >
              <Repeat2 size={20} />
              <span>{formatNum(retweetsCount)}</span>
            </button>
            <button
              onClick={handleLike}
              className={`icon-btn icon-like flex items-center gap-2 text-sm ${liked ? 'text-pink-500' : ''}`}
              aria-pressed={liked}
            >
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
              <span>{formatNum(likesCount)}</span>
            </button>
            <button onClick={stop} className="icon-btn icon-share flex items-center gap-2 text-sm">
              <BarChart3 size={18} />
              <span>{formatNum(tweet.views)}</span>
            </button>
            <button onClick={stop} className="icon-btn icon-share"><Bookmark size={18} /></button>
            <button onClick={stop} className="icon-btn icon-share"><Share size={18} /></button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default Tweet;
