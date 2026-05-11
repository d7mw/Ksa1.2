import React, { useState } from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import EditProfileModal from '../components/EditProfileModal';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 inline-block verified-badge fill-current">
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);

const Profile = () => {
  const { lang, user, tweets, getUserById } = useApp();
  const nav = useNavigate();
  const me = user || getUserById('u_me');
  const myTweets = tweets.filter((tw) => tw.userId === me.id || tw.isMe);
  const [tab, setTab] = useState('posts');
  const [editOpen, setEditOpen] = useState(false);

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-2 flex items-center gap-4">
        <button onClick={() => nav(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} className="flip-rtl" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold flex items-center gap-1">
            {me.name} {me.verified && <VerifiedIcon />}
          </h1>
          <p className="text-xs text-zinc-500">{myTweets.length} {t(lang, 'posts')}</p>
        </div>
      </header>

      {/* Cover */}
      <div className="relative">
        <div className="h-48 w-full bg-gradient-to-br from-green-900 to-emerald-700">
          {me.cover && <img src={me.cover} alt="cover" className="w-full h-full object-cover" />}
        </div>
        <img
          src={me.avatar}
          alt={me.name}
          className="absolute -bottom-16 start-4 w-32 h-32 rounded-full border-4 border-black object-cover"
        />
        <div className="flex justify-end p-3">
          <button
            onClick={() => setEditOpen(true)}
            className="btn-outline px-4 py-1.5 rounded-full font-bold text-sm"
          >
            {t(lang, 'edit')}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pt-20 pb-4">
        <h2 className="text-xl font-extrabold flex items-center gap-1">
          {me.name} {me.verified && <VerifiedIcon />}
        </h2>
        <p className="text-zinc-500">@{me.username}</p>
        {me.bio && <p className="mt-3 text-[15px]">{me.bio}</p>}
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-zinc-500">
          {me.location && (
            <span className="flex items-center gap-1"><MapPin size={14} /> {me.location}</span>
          )}
          <span className="flex items-center gap-1"><Calendar size={14} /> {t(lang, 'joined')} {me.joined}</span>
        </div>
        <div className="flex gap-4 mt-3 text-sm">
          <span><span className="font-bold">{me.following ?? 0}</span> <span className="text-zinc-500">{t(lang, 'followingCount')}</span></span>
          <span><span className="font-bold">{me.followers ?? 0}</span> <span className="text-zinc-500">{t(lang, 'followers')}</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900">
        {['posts', 'replies', 'media', 'likes'].map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="flex-1 py-3.5 text-sm font-semibold hover:bg-white/5 transition-colors relative"
          >
            <span className={tab === k ? 'text-white' : 'text-zinc-500'}>{t(lang, k)}</span>
            {tab === k && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-green-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'posts' && (myTweets.length ? myTweets.map((tw) => <Tweet key={tw.id} tweet={tw} />) : (
          <div className="text-center py-16 text-zinc-500">
            {lang === 'ar' ? 'لم تنشر أي تغريدة بعد.' : 'No posts yet.'}
          </div>
        ))}
        {tab === 'media' && (
          <div className="grid grid-cols-3 gap-1 p-1">
            {myTweets.filter((t) => t.image).map((t) => (
              <img key={t.id} src={t.image} alt="" className="aspect-square object-cover rounded" />
            ))}
          </div>
        )}
        {tab === 'likes' && tweets.filter((tw) => tw.liked).map((tw) => <Tweet key={tw.id} tweet={tw} />)}
        {tab === 'replies' && (
          <div className="text-center py-16 text-zinc-500">{lang === 'ar' ? 'لا توجد ردود.' : 'No replies.'}</div>
        )}
      </div>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </Layout>
  );
};

export default Profile;
