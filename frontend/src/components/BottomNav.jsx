import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, Bell, Mail, User, Shield, Feather } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { notificationsApi, messagesApi } from '../api';

const BottomNav = () => {
  const { user } = useApp();
  const nav = useNavigate();
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchAll = () => {
      notificationsApi.unreadCount().then((d) => setUnreadNotif(d.count || 0)).catch(() => {});
      messagesApi.unreadCount().then((d) => setUnreadMsgs(d.count || 0)).catch(() => {});
    };
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, [user]);

  if (!user) return null;

  const item = (to, Icon, badge = 0) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 flex items-center justify-center py-3 relative ${isActive ? 'text-green-500' : 'text-zinc-400'}`
      }
    >
      <div className="relative">
        <Icon size={24} />
        {badge > 0 && (
          <span className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
    </NavLink>
  );

  const goCompose = () => {
    if (window.location.pathname !== '/home') nav('/home');
    setTimeout(() => {
      const el = document.querySelector('textarea');
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (
    <>
      {/* Floating compose button */}
      <button
        onClick={goCompose}
        className="md:hidden fixed bottom-20 end-4 z-30 w-14 h-14 rounded-full btn-primary shadow-2xl shadow-green-900/50 flex items-center justify-center"
        aria-label="Compose"
      >
        <Feather size={22} />
      </button>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-md border-t border-zinc-900 flex items-center safe-bottom">
        {item('/home', Home)}
        {item('/explore', Search)}
        {item('/notifications', Bell, unreadNotif)}
        {item('/messages', Mail, unreadMsgs)}
        {item('/profile', User)}
        {user.is_admin && item('/admin', Shield)}
      </nav>
    </>
  );
};

export default BottomNav;
