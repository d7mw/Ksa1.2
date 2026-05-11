import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Loader2, Users } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usersApi } from '../api';

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 verified-badge fill-current flex-shrink-0">
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);

const FALLBACK_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%231f2a24'/></svg>";

/**
 * Modal showing followers OR following of a username.
 * mode: 'followers' | 'following'
 */
const FollowListModal = ({ open, onClose, username, mode, onFollowChange }) => {
  const { lang, user } = useApp();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState({}); // username -> bool

  useEffect(() => {
    if (!open || !username) return;
    let cancelled = false;
    setLoading(true);
    const fn = mode === 'followers' ? usersApi.followers : usersApi.following;
    fn(username)
      .then((data) => { if (!cancelled) setItems(data || []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, username, mode]);

  if (!open) return null;

  const onClickUser = (u) => {
    onClose?.();
    nav(`/${u.username}`);
  };

  const toggleFollow = async (u) => {
    if (busy[u.username]) return;
    setBusy((b) => ({ ...b, [u.username]: true }));
    // Optimistic
    setItems((arr) => arr.map((x) => x.id === u.id ? { ...x, is_following: !x.is_following } : x));
    try {
      const r = await usersApi.follow(u.username);
      // Sync (server is source of truth)
      setItems((arr) => arr.map((x) => x.id === u.id ? { ...x, is_following: r.following } : x));
      onFollowChange?.({ username: u.username, following: r.following, targetFollowersCount: r.target_followers_count });
    } catch (e) {
      // revert
      setItems((arr) => arr.map((x) => x.id === u.id ? { ...x, is_following: !x.is_following } : x));
    } finally {
      setBusy((b) => ({ ...b, [u.username]: false }));
    }
  };

  const title = mode === 'followers'
    ? (lang === 'ar' ? 'المتابِعون' : 'Followers')
    : (lang === 'ar' ? 'يتابعهم' : 'Following');

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0a100d] border border-zinc-800 rounded-none sm:rounded-2xl w-full max-w-md max-h-[100vh] sm:max-h-[80vh] h-full sm:h-auto flex flex-col shadow-2xl">
        <header className="sticky top-0 bg-[#0a100d]/95 backdrop-blur-md border-b border-zinc-900 flex items-center gap-4 px-4 py-3">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold truncate">{title}</h2>
            <p className="text-xs text-zinc-500 truncate">@{username}</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-green-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Users size={40} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-400 font-semibold">
                {mode === 'followers'
                  ? (lang === 'ar' ? 'لا يوجد متابِعون بعد' : 'No followers yet')
                  : (lang === 'ar' ? 'لا يتابع أحداً بعد' : 'Not following anyone yet')}
              </p>
            </div>
          ) : (
            items.map((u) => (
              <div
                key={u.id}
                onClick={() => onClickUser(u)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-zinc-900"
              >
                <Link
                  to={`/${u.username}`}
                  onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                  className="flex-shrink-0"
                >
                  <img src={u.avatar || FALLBACK_AVATAR} alt={u.name} className="w-11 h-11 rounded-full object-cover bg-zinc-800" />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate flex items-center gap-1">
                    {u.name}
                    {u.verified && <VerifiedIcon />}
                  </p>
                  <p className="text-zinc-500 text-sm truncate">@{u.username}</p>
                  {u.bio && <p className="text-zinc-400 text-xs mt-0.5 truncate">{u.bio}</p>}
                </div>
                {!u.is_self && user && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFollow(u); }}
                    disabled={busy[u.username]}
                    className={u.is_following
                      ? 'btn-outline px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm flex-shrink-0'
                      : 'bg-white text-black hover:bg-zinc-200 transition-colors px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm flex-shrink-0'}
                  >
                    {u.is_following
                      ? (lang === 'ar' ? 'يتابَع' : 'Following')
                      : (lang === 'ar' ? 'متابعة' : 'Follow')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowListModal;
