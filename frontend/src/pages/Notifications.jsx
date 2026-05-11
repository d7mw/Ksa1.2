import React from 'react';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { notifications } from '../mock';
import { t } from '../i18n';
import { Heart, UserPlus, Repeat2, MessageCircle, Settings } from 'lucide-react';

const typeIcon = {
  like: <Heart size={26} className="text-pink-500 fill-pink-500" />,
  follow: <UserPlus size={26} className="text-green-500" />,
  retweet: <Repeat2 size={26} className="text-green-500" />,
  reply: <MessageCircle size={26} className="text-green-500" />,
};

const Notifications = () => {
  const { lang, getUserById } = useApp();

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-extrabold">{t(lang, 'notifications')}</h1>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <div>
        {notifications.map((n) => {
          const u = getUserById(n.userId);
          return (
            <div key={n.id} className="flex gap-4 px-4 py-4 border-b border-zinc-900 hover:bg-white/5 cursor-pointer transition-colors">
              <div className="w-8 flex-shrink-0 flex justify-center pt-1">{typeIcon[n.type]}</div>
              <div className="flex-1 min-w-0">
                <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover mb-2" />
                <p className="text-[15px]">
                  <span className="font-bold">{u.name}</span>{' '}
                  <span className="text-zinc-400">{n.text}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">{n.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
};

export default Notifications;
