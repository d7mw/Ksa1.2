import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, Bell, Mail, Bookmark, User, MoreHorizontal, Feather, LogOut, Languages, Shield, Settings as SettingsIcon } from 'lucide-react';
import { LOGO_URL } from '../mock';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { notificationsApi } from '../api';

const NavItem = ({ to, icon: Icon, label, badge }) => (
  <NavLink to={to} className={({ isActive }) =>
    `nav-pill flex items-center gap-4 px-4 py-3 rounded-full text-xl ${isActive ? 'font-bold text-white' : 'font-normal text-zinc-100'}`
  }>
    {({ isActive }) => (
      <>
        <div className="relative">
          <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
          {badge > 0 && (
            <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <span className="hidden xl:inline">{label}</span>
      </>
    )}
  </NavLink>
);

const Sidebar = () => {
  const { lang, toggleLang, user, logout } = useApp();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => notificationsApi.unreadCount().then((d) => setUnread(d.count)).catch(() => {});
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => clearInterval(t);
  }, [user]);

  if (!user) return null;

  const handleLogout = () => {
    if (!window.confirm(lang === 'ar' ? 'هل تريد تسجيل الخروج؟' : 'Sign out from ksa1?')) return;
    logout();
    nav('/login');
  };
  const goCompose = () => {
    if (window.location.pathname === '/home') {
      const el = document.querySelector('textarea');
      el?.focus();
    } else {
      nav('/home');
    }
  };

  return (
    <aside className="sticky top-0 h-screen flex flex-col justify-between py-2 px-2 xl:px-4 w-[88px] xl:w-[275px]">
      <div>
        <div className="px-3 py-2 mb-2">
          <img src={LOGO_URL} alt="ksa1" className="w-12 h-12 rounded-2xl logo-glow object-cover" />
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem to="/home" icon={Home} label={t(lang, 'home')} />
          <NavItem to="/explore" icon={Search} label={t(lang, 'explore')} />
          <NavItem to="/notifications" icon={Bell} label={t(lang, 'notifications')} badge={unread} />
          <NavItem to="/messages" icon={Mail} label={t(lang, 'messages')} />
          <NavItem to="/bookmarks" icon={Bookmark} label={t(lang, 'bookmarks')} />
          <NavItem to="/profile" icon={User} label={t(lang, 'profile')} />
          {user.is_admin && (
            <NavItem to="/admin" icon={Shield} label={lang === 'ar' ? 'لوحة الأدمن' : 'Admin'} />
          )}
          <NavItem to="/settings" icon={SettingsIcon} label={lang === 'ar' ? 'الإعدادات' : 'Settings'} />
          <button onClick={toggleLang} className="nav-pill flex items-center gap-4 px-4 py-3 rounded-full text-xl text-zinc-100">
            <Languages size={26} />
            <span className="hidden xl:inline">{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
          <button onClick={handleLogout} className="nav-pill flex items-center gap-4 px-4 py-3 rounded-full text-xl text-zinc-100 hover:text-red-400">
            <LogOut size={26} />
            <span className="hidden xl:inline">{lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
          </button>
        </nav>

        <button onClick={goCompose}
          className="btn-primary mt-4 w-12 h-12 xl:w-full xl:h-auto xl:py-3.5 rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-900/30">
          <Feather size={22} className="xl:hidden" />
          <span className="hidden xl:inline">{t(lang, 'post')}</span>
        </button>
      </div>

      <div className="nav-pill flex items-center gap-3 p-2 xl:p-3 rounded-full cursor-pointer" onClick={handleLogout}>
        <img src={user.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt={user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-zinc-800" />
        <div className="hidden xl:block flex-1 min-w-0">
          <p className="font-bold text-sm truncate flex items-center gap-1">
            {user.name}
            {user.verified && (
              <svg viewBox="0 0 24 24" className="w-4 h-4 verified-badge fill-current"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>
            )}
          </p>
          <p className="text-zinc-500 text-sm truncate">@{user.username}</p>
        </div>
        <LogOut size={18} className="hidden xl:block text-zinc-500" />
      </div>
    </aside>
  );
};

export default Sidebar;
