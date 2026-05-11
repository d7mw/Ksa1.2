import React, { useEffect, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { usersApi } from '../api';
import { useNavigate, Link } from 'react-router-dom';

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 verified-badge fill-current flex-shrink-0"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>
);

const RightSidebar = () => {
  const { lang, user } = useApp();
  const nav = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);

  useEffect(() => {
    if (!user) return;
    usersApi.suggestions().then(setSuggestions).catch(() => {});
  }, [user]);

  const onFollow = async (username, id) => {
    try {
      const r = await usersApi.follow(username);
      if (r.following) setFollowingIds((ids) => [...ids, id]);
      else setFollowingIds((ids) => ids.filter((i) => i !== id));
    } catch (e) { console.error(e); }
  };

  return (
    <aside className="sticky top-0 h-screen overflow-y-auto py-2 px-4 w-[350px] hidden lg:block">
      <div className="sticky top-0 bg-black pt-1 pb-3 z-10">
        <div className="relative">
          <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-zinc-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
          <input
            type="text"
            placeholder={t(lang, 'search')}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) nav(`/explore?q=${encodeURIComponent(e.target.value)}`); }}
            className={`w-full bg-[#0c1410] border border-transparent focus:border-green-600 focus:bg-black rounded-full py-3 ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm outline-none transition-colors`}
          />
        </div>
      </div>

      <div className="bg-[#0c1410] rounded-2xl p-4 mb-4 border border-zinc-900">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} className="text-green-500" />
          <h2 className="text-xl font-extrabold">ksa1 Premium</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-3">
          {lang === 'ar' ? 'وثّق حسابك بعلامة الصح الخضراء واحصل على ميزات حصرية.' : 'Get the green check and exclusive features.'}
        </p>
        <button onClick={() => nav('/profile')} className="btn-primary px-5 py-2 rounded-full font-bold text-sm">
          {lang === 'ar' ? 'اطلب التوثيق' : 'Get verified'}
        </button>
      </div>

      <div className="bg-[#0c1410] rounded-2xl mb-4 border border-zinc-900">
        <h2 className="text-xl font-extrabold px-4 pt-3 pb-2">{t(lang, 'whoToFollow')}</h2>
        {suggestions.length === 0 && (
          <p className="text-sm text-zinc-500 px-4 pb-3">{lang === 'ar' ? 'لا توجد اقتراحات بعد' : 'No suggestions yet'}</p>
        )}
        {suggestions.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
            <Link to={`/u/${u.username}`} className="flex-shrink-0">
              <img src={u.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt={u.name} className="w-10 h-10 rounded-full object-cover bg-zinc-800 hover:opacity-90 transition-opacity" />
            </Link>
            <Link to={`/u/${u.username}`} className="flex-1 min-w-0 hover:underline">
              <p className="font-bold text-sm truncate flex items-center gap-1">
                {u.name} {u.verified && <VerifiedIcon />}
              </p>
              <p className="text-zinc-500 text-sm truncate">@{u.username}</p>
            </Link>
            <button onClick={() => onFollow(u.username, u.id)} className="bg-white text-black font-bold text-sm px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors">
              {followingIds.includes(u.id) ? t(lang, 'unfollow') : t(lang, 'follow')}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-600 px-4">
        © 2025 ksa1 · {lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy'} · {lang === 'ar' ? 'الشروط' : 'Terms'}
      </p>
    </aside>
  );
};

export default RightSidebar;
