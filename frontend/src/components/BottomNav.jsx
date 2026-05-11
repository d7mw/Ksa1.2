import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Search, Bell, Mail, User, Shield, Feather } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const BottomNav = () => {
  const { user } = useApp();
  const nav = useNavigate();
  if (!user) return null;

  const item = (to, Icon) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 flex items-center justify-center py-3 ${isActive ? 'text-green-500' : 'text-zinc-400'}`
      }
    >
      <Icon size={24} />
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
        {item('/notifications', Bell)}
        {item('/messages', Mail)}
        {item('/profile', User)}
        {user.is_admin && item('/admin', Shield)}
      </nav>
    </>
  );
};

export default BottomNav;
