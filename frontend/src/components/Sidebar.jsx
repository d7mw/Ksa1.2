import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, Bell, Mail, Bookmark, User, MoreHorizontal, Feather, LogOut, Languages } from 'lucide-react';
import { LOGO_URL } from '../mock';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `nav-pill flex items-center gap-4 px-4 py-3 rounded-full text-xl ${
        isActive ? 'font-bold text-white' : 'font-normal text-zinc-100'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
        <span className="hidden xl:inline">{label}</span>
      </>
    )}
  </NavLink>
);

const Sidebar = ({ onCompose }) => {
  const { lang, toggleLang, user, logout, getUserById } = useApp();
  const nav = useNavigate();
  const me = user || getUserById('u_me');

  const handleLogout = () => {
    logout();
    nav('/login');
  };

  return (
    <aside className="sticky top-0 h-screen flex flex-col justify-between py-2 px-2 xl:px-4 w-[88px] xl:w-[275px]">
      <div>
        {/* Logo */}
        <div className="px-3 py-2 mb-2">
          <img src={LOGO_URL} alt="ksa1" className="w-12 h-12 rounded-2xl logo-glow object-cover" />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          <NavItem to="/home" icon={Home} label={t(lang, 'home')} />
          <NavItem to="/explore" icon={Search} label={t(lang, 'explore')} />
          <NavItem to="/notifications" icon={Bell} label={t(lang, 'notifications')} />
          <NavItem to="/messages" icon={Mail} label={t(lang, 'messages')} />
          <NavItem to="/bookmarks" icon={Bookmark} label={t(lang, 'bookmarks')} />
          <NavItem to="/profile" icon={User} label={t(lang, 'profile')} />
          <button
            onClick={toggleLang}
            className="nav-pill flex items-center gap-4 px-4 py-3 rounded-full text-xl text-zinc-100"
          >
            <Languages size={26} />
            <span className="hidden xl:inline">{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
          <button className="nav-pill flex items-center gap-4 px-4 py-3 rounded-full text-xl text-zinc-100">
            <MoreHorizontal size={26} />
            <span className="hidden xl:inline">{t(lang, 'more')}</span>
          </button>
        </nav>

        {/* Post button */}
        <button
          onClick={onCompose}
          className="btn-primary mt-4 w-12 h-12 xl:w-full xl:h-auto xl:py-3.5 rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-900/30"
        >
          <Feather size={22} className="xl:hidden" />
          <span className="hidden xl:inline">{t(lang, 'post')}</span>
        </button>
      </div>

      {/* Profile card */}
      <div className="nav-pill flex items-center gap-3 p-2 xl:p-3 rounded-full cursor-pointer" onClick={handleLogout}>
        <img src={me.avatar} alt={me.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        <div className="hidden xl:block flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{me.name}</p>
          <p className="text-zinc-500 text-sm truncate">@{me.username}</p>
        </div>
        <LogOut size={18} className="hidden xl:block text-zinc-500" />
      </div>
    </aside>
  );
};

export default Sidebar;
