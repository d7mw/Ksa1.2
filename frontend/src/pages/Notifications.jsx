import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { notificationsApi } from '../api';
import { t } from '../i18n';
import { Heart, UserPlus, Repeat2, MessageCircle, Settings, BadgeCheck, Loader2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { formatDateTime } from '../utils/dates';

const typeIcon = {
  like: <Heart size={26} className="text-pink-500 fill-pink-500" />,
  follow: <UserPlus size={26} className="text-green-500" />,
  retweet: <Repeat2 size={26} className="text-green-500" />,
  reply: <MessageCircle size={26} className="text-green-500" />,
  verified: <BadgeCheck size={26} className="text-green-500" />,
};

const Notifications = () => {
  const { lang } = useApp();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsApi.list().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const text = (n) => {
    const map = {
      ar: {
        like: 'أعجب بتغريدتك',
        follow: 'بدأ بمتابعتك',
        retweet: 'أعاد نشر تغريدتك',
        reply: 'رد على تغريدتك',
        verified: 'تم توثيق حسابك! 🎉',
      },
      en: {
        like: 'liked your post',
        follow: 'followed you',
        retweet: 'reposted your post',
        reply: 'replied to your post',
        verified: 'Your account has been verified! 🎉',
      },
    };
    return map[lang][n.type] || n.type;
  };

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-extrabold">{t(lang, 'notifications')}</h1>
          <button className="p-2 rounded-full hover:bg-white/5 transition-colors"><Settings size={20} /></button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 px-6">
          <p className="text-2xl font-extrabold mb-2">{lang === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}</p>
          <p className="text-zinc-500">{lang === 'ar' ? 'ستظهر الإشعارات هنا عند التفاعل مع تغريداتك.' : 'Activity on your account will appear here.'}</p>
        </div>
      ) : items.map((n) => (
        <div key={n.id} onClick={() => n.tweet_id && nav(`/tweet/${n.tweet_id}`)} className="flex gap-4 px-4 py-4 border-b border-zinc-900 hover:bg-white/5 cursor-pointer transition-colors">
          <div className="w-8 flex-shrink-0 flex justify-center pt-1">{typeIcon[n.type] || typeIcon.like}</div>
          <div className="flex-1 min-w-0">
            {n.actor && (
              <Link to={`/${n.actor.username}`} onClick={(e) => e.stopPropagation()}>
                <img src={n.actor.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-9 h-9 rounded-full object-cover mb-2 bg-zinc-800 hover:opacity-90 transition-opacity" />
              </Link>
            )}
            <p className="text-[15px]">
              {n.actor && (
                <Link to={`/${n.actor.username}`} onClick={(e) => e.stopPropagation()} className="font-bold hover:underline">{n.actor.name} </Link>
              )}
              <span className="text-zinc-400">{text(n)}</span>
            </p>
            {n.preview && <p className="text-sm text-zinc-500 mt-1">{n.preview}</p>}
            <p className="text-xs text-zinc-500 mt-1">{formatDateTime(n.created_at, lang)}</p>
          </div>
        </div>
      ))}
    </Layout>
  );
};

export default Notifications;
