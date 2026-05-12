import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import Tweet from '../components/Tweet';
import EditProfileModal from '../components/EditProfileModal';
import VerificationModal from '../components/VerificationModal';
import FollowListModal from '../components/FollowListModal';
import UserNotFound from '../components/UserNotFound';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { ArrowLeft, Calendar, MapPin, BadgeCheck, Clock, Loader2, Settings as SettingsIcon, MessageSquare } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersApi } from '../api';
import { messagesApi } from '../api';
import { isReservedPath, isValidUsernameFormat } from '../utils/reservedPaths';
import { formatMonthYear } from '../utils/dates';

const VerifiedIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" className="verified-badge fill-current flex-shrink-0" width={size} height={size}>
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);

const Profile = () => {
  const params = useParams();
  const urlUsername = params.username || params.handle;
  const { lang, user, setUser } = useApp();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [tab, setTab] = useState('posts');
  const [editOpen, setEditOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [followListMode, setFollowListMode] = useState(null); // 'followers' | 'following' | null
  const [loading, setLoading] = useState(true);

  const isMe = !urlUsername || (user && urlUsername.toLowerCase() === user.username);
  const targetUsername = urlUsername ? urlUsername.toLowerCase() : user?.username;

  // Reject invalid handles & reserved paths at this layer too (defense-in-depth)
  const invalidHandle = !!urlUsername && (isReservedPath(urlUsername) || !isValidUsernameFormat(urlUsername));

  useEffect(() => {
    if (!targetUsername || invalidHandle) {
      setLoading(false);
      setProfile(null);
      return;
    }
    setLoading(true);
    usersApi.get(targetUsername)
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [targetUsername, invalidHandle]);

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
    // Optimistic update
    const wasFollowing = profile.is_following;
    setProfile((p) => ({
      ...p,
      is_following: !wasFollowing,
      followers_count: !wasFollowing ? p.followers_count + 1 : Math.max(0, p.followers_count - 1),
    }));
    // Update my own following count instantly in context
    if (user) {
      setUser((cur) => cur ? { ...cur, following_count: !wasFollowing ? (cur.following_count || 0) + 1 : Math.max(0, (cur.following_count || 0) - 1) } : cur);
    }
    try {
      const r = await usersApi.follow(profile.username);
      // Sync with server truth
      setProfile((p) => ({
        ...p,
        is_following: r.following,
        followers_count: r.target_followers_count ?? p.followers_count,
      }));
    } catch (e) {
      // Revert on error
      setProfile((p) => ({
        ...p,
        is_following: wasFollowing,
        followers_count: wasFollowing ? p.followers_count + 1 : Math.max(0, p.followers_count - 1),
      }));
      if (user) {
        setUser((cur) => cur ? { ...cur, following_count: wasFollowing ? (cur.following_count || 0) + 1 : Math.max(0, (cur.following_count || 0) - 1) } : cur);
      }
    }
  };

  // Called when a follow toggle happens inside the FollowListModal
  const handleFollowChange = ({ username, following, targetFollowersCount }) => {
    // If user toggled a follow that involves the profile we're viewing, update it
    if (profile && username === profile.username) {
      setProfile((p) => ({
        ...p,
        is_following: following,
        followers_count: targetFollowersCount ?? p.followers_count,
      }));
    }
    // Update my own following_count
    if (user) {
      setUser((cur) => cur ? { ...cur, following_count: following ? (cur.following_count || 0) + 1 : Math.max(0, (cur.following_count || 0) - 1) } : cur);
    }
    // If we're viewing OUR profile and the modal showed "following" list,
    // and we just un-followed someone there, refresh our profile counts.
    if (isMe) {
      usersApi.get(targetUsername).then(setProfile).catch(() => {});
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-green-500" size={32} />
        </div>
      </Layout>
    );
  }
  if (!profile) {
    return <UserNotFound handle={urlUsername} />;
  }

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-2 flex items-center gap-4">
        <button onClick={() => nav(-1)} className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} className="flip-rtl" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold flex items-center gap-1">
            {profile.name} {profile.verified && <VerifiedIcon size={18} />}
          </h1>
          <p className="text-xs text-zinc-500">{tweets.length} {t(lang, 'posts')}</p>
        </div>
        {isMe && (
          <button
            data-testid="profile-settings-btn"
            onClick={() => nav('/settings')}
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
            aria-label={lang === 'ar' ? 'الإعدادات' : 'Settings'}
          >
            <SettingsIcon size={20} />
          </button>
        )}
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
            <>
              <button
                data-testid="profile-message-btn"
                onClick={async () => {
                  try {
                    const conv = await messagesApi.start(profile.username);
                    nav(`/messages/${conv.id}`);
                  } catch {/* ignore */}
                }}
                className="btn-outline w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center"
                aria-label={lang === 'ar' ? 'مراسلة' : 'Message'}
              >
                <MessageSquare size={16} />
              </button>
              <button onClick={handleFollow} className={profile.is_following ? 'btn-outline px-5 py-1.5 rounded-full font-bold text-sm' : 'bg-white text-black hover:bg-zinc-200 transition-colors px-5 py-1.5 rounded-full font-bold text-sm'}>
                {profile.is_following ? t(lang, 'unfollow') : t(lang, 'follow')}
              </button>
            </>
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
            <span className="flex items-center gap-1"><Calendar size={14} /> {t(lang, 'joined')} {formatMonthYear(profile.created_at, lang)}</span>
          )}
        </div>
        <div className="flex gap-4 mt-3 text-sm">
          <button
            onClick={() => setFollowListMode('following')}
            className="hover:underline"
          >
            <span className="font-bold">{profile.following_count || 0}</span>{' '}
            <span className="text-zinc-500">{t(lang, 'followingCount')}</span>
          </button>
          <button
            onClick={() => setFollowListMode('followers')}
            className="hover:underline"
          >
            <span className="font-bold">{profile.followers_count || 0}</span>{' '}
            <span className="text-zinc-500">{t(lang, 'followers')}</span>
          </button>
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
      <FollowListModal
        open={!!followListMode}
        onClose={() => setFollowListMode(null)}
        username={profile.username}
        mode={followListMode}
        onFollowChange={handleFollowChange}
      />
    </Layout>
  );
};

export default Profile;
