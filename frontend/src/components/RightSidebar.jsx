import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { trends, users } from '../mock';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';

const RightSidebar = () => {
  const { lang, followingIds, toggleFollow } = useApp();
  const suggested = users.filter((u) => !followingIds.includes(u.id)).slice(0, 3);

  return (
    <aside className="sticky top-0 h-screen overflow-y-auto py-2 px-4 w-[350px] hidden lg:block">
      {/* Search */}
      <div className="sticky top-0 bg-black pt-1 pb-3 z-10">
        <div className="relative">
          <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-zinc-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
          <input
            type="text"
            placeholder={t(lang, 'search')}
            className={`w-full bg-[#0c1410] border border-transparent focus:border-green-600 focus:bg-black rounded-full py-3 ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm outline-none transition-colors`}
          />
        </div>
      </div>

      {/* Premium card */}
      <div className="bg-[#0c1410] rounded-2xl p-4 mb-4 border border-zinc-900">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} className="text-green-500" />
          <h2 className="text-xl font-extrabold">ksa1 Premium</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-3">
          {lang === 'ar' ? 'اشترك في Premium واحصل على ميزات حصرية والتوثيق الأخضر.' : 'Subscribe to unlock new features and the green verification.'}
        </p>
        <button className="btn-primary px-5 py-2 rounded-full font-bold text-sm">
          {lang === 'ar' ? 'اشترك' : 'Subscribe'}
        </button>
      </div>

      {/* Trends */}
      <div className="bg-[#0c1410] rounded-2xl mb-4 border border-zinc-900">
        <h2 className="text-xl font-extrabold px-4 pt-3 pb-2">{t(lang, 'whatsHappening2')}</h2>
        {trends.map((tr, i) => (
          <div key={i} className="px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors">
            <p className="text-xs text-zinc-500">{tr.category}</p>
            <p className="font-bold text-[15px]">{tr.tag}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{tr.posts}</p>
          </div>
        ))}
        <button className="w-full text-start px-4 py-3 text-green-500 hover:bg-white/5 rounded-b-2xl transition-colors text-sm">
          {t(lang, 'showMore')}
        </button>
      </div>

      {/* Who to follow */}
      <div className="bg-[#0c1410] rounded-2xl mb-4 border border-zinc-900">
        <h2 className="text-xl font-extrabold px-4 pt-3 pb-2">{t(lang, 'whoToFollow')}</h2>
        {suggested.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
            <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate flex items-center gap-1">
                {u.name}
                {u.verified && (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 verified-badge fill-current"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>
                )}
              </p>
              <p className="text-zinc-500 text-sm truncate">@{u.username}</p>
            </div>
            <button
              onClick={() => toggleFollow(u.id)}
              className="bg-white text-black font-bold text-sm px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors"
            >
              {t(lang, 'follow')}
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
