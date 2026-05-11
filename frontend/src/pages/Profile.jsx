import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import EditProfileModal from '../components/EditProfileModal';
import VerificationModal from '../components/VerificationModal';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { ArrowLeft, Calendar, MapPin, BadgeCheck, Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersApi } from '../api';

const VerifiedIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" className="verified-badge fill-current flex-shrink-0" width={size} height={size}>
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);

const Profile = () => {
  const { username: urlUsername } = useParams();
  const { lang, user } = useApp();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [tab, setTab] = useState('posts');
  const [editOpen, setEditOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const isMe = !urlUsername || (user && urlUsername === user.username);
  const targetUsername = urlUsername || user?.username;

  useEffect(() => {
    if (!targetUsername) return;
    setLoading(true);
    usersApi.get(targetUsername)
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [targetUsername]);

  const refreshTweets = useCallback(() => {
    if (!targetUsername) return;
    usersApi.tweets(targetUsername, tab).then(setTweets).catch(() => setTweets([]));
  }, [targetUsername, tab]);

  useEffect(() => { refreshTweets(); }, [refreshTweets]);

  const handleActionDone = (action) => {
    // When user toggles retweet/delete on their own profile, refresh feed so
    // retweets appear/disappear immediately.
    if (!isMe) return;
    if (action?.type === 'retweet' || action?.type === 'delete') {
      refreshTweets();
    }
  };

  const refreshProfile = () => {
    usersApi.get(targetUsername).then(setProfile).catch(() => {});
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      const r = await usersApi.follow(profile.username);
      setProfile((p) => ({
        ...p,
        is_following: r.following,
        followers_count: r.following ? p.followers_count + 1 : Math.max(0, p.followers_count - 1),
      }));
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return <Layout><div className="py-20 text-center text-zinc-500">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div></Layout>;
  }
  if (!profile) {
    return <Layout><div className="py-20 text-center text-zinc-500">{lang === 'ar' ? 'الحساب غير موجود' : 'Account not found'}</div></Layout>;
  }

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-2 flex items-center gap-4">
        <button onClick={() => nav(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} className="flip-rtl" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold flex items-center gap-1">
            {profile.name} {profile.verified && <VerifiedIcon size={18} />}
          </h1>
          <p className="text-xs text-zinc-500">{tweets.length} {t(lang, 'posts')}</p>
        </div>
      </header>

      <div className="relative">
        <div className="h-32 sm:h-48 w-full bg-gradient-to-br from-green-900 to-emerald-700">
          {profile.cover && <img src={profile.cover} alt="" className="w-full h-full object-cover" />}
        </div>
        <img
          src={profile.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 128 128\'><rect width=\'128\' height=\'128\' fill=\'%231f2a24\'/></svg>'}
          alt={profile.name}
          className="absolute -bottom-12 sm:-bottom-16 start-4 w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-black object-cover bg-zinc-800"
        />
        <div className="flex justify-end p-3 gap-2 flex-wrap">
          {isMe ? (
            <>
              {!profile.verified && !profile.verification_requested && (
                <button onClick={() => setVerifyOpen(true)} className="btn-primary px-4 py-1.5 rounded-full font-bold text-sm flex items-center gap-1.5">
                  <BadgeCheck size={16} />
                  {lang === 'ar' ? 'اطلب التوثيق' : 'Get verified'}
                </button>
              )}
              {profile.verification_requested && !profile.verified && (
                <span className="flex items-center gap-1.5 text-amber-500 text-sm border border-amber-500/30 px-3 py-1.5 rounded-full bg-amber-500/10">
                  <Clock size={14} />
                  {lang === 'ar' ? 'الطلب قيد المراجعة' : 'Pending review'}
                </span>
              )}
              <button onClick={() => setEditOpen(true)} className="btn-outline px-4 py-1.5 rounded-full font-bold text-sm">{t(lang, 'edit')}</button>
            </>
          ) : (
            <button onClick={handleFollow} className={profile.is_following ? 'btn-outline px-5 py-1.5 rounded-full font-bold text-sm' : 'bg-white text-black hover:bg-zinc-200 transition-colors px-5 py-1.5 rounded-full font-bold text-sm'}>
              {profile.is_following ? t(lang, 'unfollow') : t(lang, 'follow')}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-16 sm:pt-20 pb-4">
        <h2 className="text-xl font-extrabold flex items-center gap-1">
          {profile.name} {profile.verified && <VerifiedIcon />}
        </h2>
        <p className="text-zinc-500">@{profile.username}</p>
        {profile.bio && <p className="mt-3 text-[15px]">{profile.bio}</p>}
        <div className="flex flex-wrap gap-4 mt-3 text-sm text-zinc-500">
          {profile.location && <span className="flex items-center gap-1"><MapPin size={14} /> {profile.location}</span>}
          {profile.created_at && (
            <span className="flex items-center gap-1"><Calendar size={14} /> {t(lang, 'joined')} {new Date(profile.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long' })}</span>
          )}
        </div>
        <div className="flex gap-4 mt-3 text-sm">
          <span><span className="font-bold">{profile.following_count || 0}</span> <span className="text-zinc-500">{t(lang, 'followingCount')}</span></span>
          <span><span className="font-bold">{profile.followers_count || 0}</span> <span className="text-zinc-500">{t(lang, 'followers')}</span></span>
        </div>
      </div>

      <div className="flex border-b border-zinc-900">
        {['posts', 'replies', 'media', 'likes'].map((k) => (
          <button key={k} onClick={() => setTab(k)} className="flex-1 py-3.5 text-sm font-semibold hover:bg-white/5 transition-colors relative">
            <span className={tab === k ? 'text-white' : 'text-zinc-500'}>{t(lang, k)}</span>
            {tab === k && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-green-500 rounded-full" />}
          </button>
        ))}
      </div>

      <div>
        {tab === 'media' ? (
          <div className="grid grid-cols-3 gap-1 p-1">
            {tweets.filter((t) => t.image).map((tw) => (
              <img key={tw.id} src={tw.image} alt="" className="aspect-square object-cover rounded cursor-pointer" onClick={() => nav(`/tweet/${tw.id}`)} />
            ))}
          </div>
        ) : tweets.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            {lang === 'ar' ? 'لا يوجد محتوى بعد' : 'Nothing here yet'}
          </div>
        ) : (
          tweets.map((tw) => <Tweet key={`${tw.id}-${tw.retweeted_by ? 'rt' : 'own'}`} tweet={tw} onDelete={() => setTweets((ts) => ts.filter((x) => x.id !== tw.id))} onActionDone={handleActionDone} />)
        )}
      </div>

      {isMe && <EditProfileModal open={editOpen} onClose={() => { setEditOpen(false); refreshProfile(); }} />}
      {isMe && <VerificationModal open={verifyOpen} onClose={(refresh) => { setVerifyOpen(false); if (refresh) refreshProfile(); }} />}
    </Layout>
  );
};

export default Profile;
