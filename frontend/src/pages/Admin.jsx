import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { adminApi } from '../api';
import { useNavigate } from 'react-router-dom';
import {
  Users, MessageSquare, BadgeCheck, Ban, Trash2, Check, X, Search, Shield, Loader2, AlertCircle,
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-[#0c1410] border border-zinc-900 rounded-2xl p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-zinc-500 mb-1">{label}</p>
        <p className="text-3xl font-extrabold">{value ?? '-'}</p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}><Icon size={22} /></div>
    </div>
  </div>
);

const Admin = () => {
  const { lang, user } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [tweets, setTweets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reqStatus, setReqStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !user.is_admin) nav('/home');
  }, [user, nav]);

  const loadStats = () => adminApi.stats().then(setStats).catch(() => {});
  const loadUsers = (search = '') => { setLoading(true); adminApi.users(search).then(setUsers).catch(() => setUsers([])).finally(() => setLoading(false)); };
  const loadTweets = (search = '') => { setLoading(true); adminApi.tweets(search).then(setTweets).catch(() => setTweets([])).finally(() => setLoading(false)); };
  const loadRequests = (status = 'pending') => { setLoading(true); adminApi.verificationRequests(status).then(setRequests).catch(() => setRequests([])).finally(() => setLoading(false)); };

  useEffect(() => {
    loadStats();
    if (tab === 'users') loadUsers(q);
    if (tab === 'tweets') loadTweets(q);
    if (tab === 'requests') loadRequests(reqStatus);
  }, [tab, reqStatus]); // eslint-disable-line

  useEffect(() => {
    const h = setTimeout(() => {
      if (tab === 'users') loadUsers(q);
      if (tab === 'tweets') loadTweets(q);
    }, 300);
    return () => clearTimeout(h);
  }, [q]); // eslint-disable-line

  const handleVerify = async (id) => { await adminApi.verify(id); loadUsers(q); loadStats(); loadRequests(reqStatus); };
  const handleUnverify = async (id) => { await adminApi.unverify(id); loadUsers(q); loadStats(); };
  const handleBan = async (id, banned) => { if (banned) await adminApi.unban(id); else await adminApi.ban(id); loadUsers(q); loadStats(); };
  const handleDeleteUser = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'حذف الحساب نهائياً؟' : 'Delete account permanently?')) return;
    await adminApi.deleteUser(id); loadUsers(q); loadStats();
  };
  const handleDeleteTweet = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'حذف التغريدة؟' : 'Delete tweet?')) return;
    await adminApi.deleteTweet(id); loadTweets(q); loadStats();
  };
  const handleReject = async (id) => { await adminApi.rejectRequest(id); loadRequests(reqStatus); loadStats(); };

  if (!user) return null;
  if (!user.is_admin) return <Layout><div className="py-20 text-center"><AlertCircle className="mx-auto text-red-500 mb-3" size={40} /><p className="text-zinc-400">{lang === 'ar' ? 'غير مصرح، لست أدمن.' : 'Forbidden. Not admin.'}</p></div></Layout>;

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-extrabold flex items-center gap-2"><Shield className="text-green-500" size={22} /> {lang === 'ar' ? 'لوحة الأدمن' : 'Admin'}</h1>
          <span className="text-xs text-zinc-500">{user.email}</span>
        </div>
        <div className="flex overflow-x-auto">
          {[
            ['overview', lang === 'ar' ? 'نظرة عامة' : 'Overview'],
            ['users', lang === 'ar' ? 'المستخدمون' : 'Users'],
            ['tweets', lang === 'ar' ? 'التغريدات' : 'Tweets'],
            ['requests', lang === 'ar' ? 'طلبات التوثيق' : 'Verification'],
          ].map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); setQ(''); }} className="px-5 py-3 text-sm font-semibold whitespace-nowrap hover:bg-white/5 transition-colors relative">
              <span className={tab === k ? 'text-white' : 'text-zinc-500'}>{label}</span>
              {tab === k && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-green-500 rounded-full" />}
            </button>
          ))}
        </div>
      </header>

      {tab === 'overview' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
          <StatCard icon={Users} label={lang === 'ar' ? 'إجمالي المستخدمين' : 'Total users'} value={stats.users} color="bg-green-500/15 text-green-500" />
          <StatCard icon={MessageSquare} label={lang === 'ar' ? 'إجمالي التغريدات' : 'Total tweets'} value={stats.tweets} color="bg-blue-500/15 text-blue-400" />
          <StatCard icon={BadgeCheck} label={lang === 'ar' ? 'حسابات موثّقة' : 'Verified accounts'} value={stats.verified} color="bg-emerald-500/15 text-emerald-400" />
          <StatCard icon={AlertCircle} label={lang === 'ar' ? 'طلبات معلّقة' : 'Pending requests'} value={stats.pending_verifications} color="bg-amber-500/15 text-amber-400" />
          <StatCard icon={Ban} label={lang === 'ar' ? 'حسابات محظورة' : 'Banned accounts'} value={stats.banned} color="bg-red-500/15 text-red-400" />
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="p-4 border-b border-zinc-900">
            <div className="relative">
              <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-zinc-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'ar' ? 'ابحث بالاسم أو البريد' : 'Search by name/email'}
                className={`w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-full py-2.5 ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm outline-none transition-colors`} />
            </div>
          </div>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-500" /></div> :
            users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-900 hover:bg-white/5 transition-colors">
                <img src={u.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate flex items-center gap-1">
                    {u.name}
                    {u.verified && <BadgeCheck size={14} className="text-green-500" />}
                    {u.banned && <span className="text-red-500 text-xs px-1.5 rounded bg-red-500/10">{lang === 'ar' ? 'محظور' : 'banned'}</span>}
                    {u.is_admin && <Shield size={12} className="text-amber-500" />}
                  </p>
                  <p className="text-zinc-500 text-xs truncate">@{u.username} · {u.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => u.verified ? handleUnverify(u.id) : handleVerify(u.id)}
                    className={`p-2 rounded-full transition-colors ${u.verified ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20' : 'hover:bg-green-500/10 hover:text-green-500'}`}
                    title={u.verified ? 'Unverify' : 'Verify'}>
                    <BadgeCheck size={18} />
                  </button>
                  <button onClick={() => handleBan(u.id, u.banned)} className={`p-2 rounded-full transition-colors ${u.banned ? 'text-red-500 bg-red-500/10' : 'hover:bg-red-500/10 hover:text-red-500'}`} title={u.banned ? 'Unban' : 'Ban'}>
                    <Ban size={18} />
                  </button>
                  {!u.is_admin && (
                    <button onClick={() => handleDeleteUser(u.id)} className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === 'tweets' && (
        <div>
          <div className="p-4 border-b border-zinc-900">
            <div className="relative">
              <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-zinc-500 ${lang === 'ar' ? 'right-4' : 'left-4'}`} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'ar' ? 'ابحث في محتوى التغريدات' : 'Search tweet content'}
                className={`w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-full py-2.5 ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm outline-none transition-colors`} />
            </div>
          </div>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-500" /></div> :
            tweets.map((tw) => (
              <div key={tw.id} className="flex gap-3 px-4 py-3 border-b border-zinc-900 hover:bg-white/5 transition-colors">
                <img src={tw.author?.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-10 h-10 rounded-full object-cover bg-zinc-800" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm"><b>{tw.author?.name}</b> <span className="text-zinc-500">@{tw.author?.username}</span></p>
                  <p className="text-[15px] mt-0.5 whitespace-pre-wrap break-words">{tw.content}</p>
                  {tw.image && <img src={tw.image} alt="" className="mt-2 max-h-40 rounded-lg" />}
                  <p className="text-xs text-zinc-500 mt-1">{new Date(tw.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} · {tw.likes_count} likes</p>
                </div>
                <button onClick={() => handleDeleteTweet(tw.id)} className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors h-fit"><Trash2 size={18} /></button>
              </div>
            ))}
        </div>
      )}

      {tab === 'requests' && (
        <div>
          <div className="flex border-b border-zinc-900">
            {['pending', 'approved', 'rejected'].map((s) => (
              <button key={s} onClick={() => setReqStatus(s)} className="flex-1 py-3 text-sm font-semibold hover:bg-white/5 transition-colors relative">
                <span className={reqStatus === s ? 'text-white' : 'text-zinc-500'}>
                  {s === 'pending' ? (lang === 'ar' ? 'معلّق' : 'Pending') : s === 'approved' ? (lang === 'ar' ? 'موافق' : 'Approved') : (lang === 'ar' ? 'مرفوض' : 'Rejected')}
                </span>
                {reqStatus === s && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-green-500 rounded-full" />}
              </button>
            ))}
          </div>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-500" /></div> :
            requests.length === 0 ? <div className="text-center py-10 text-zinc-500">{lang === 'ar' ? 'لا توجد طلبات' : 'No requests'}</div> :
            requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-900">
                <img src={r.user?.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt="" className="w-12 h-12 rounded-full object-cover bg-zinc-800" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{r.user?.name}</p>
                  <p className="text-zinc-500 text-xs truncate">@{r.user?.username}</p>
                  <p className="text-amber-500 text-xs mt-1">
                    {r.plan === 'monthly' ? (lang === 'ar' ? 'باقة شهرية · 25 ر.س' : 'Monthly · 25 SAR') : (lang === 'ar' ? 'باقة سنوية · 200 ر.س' : 'Yearly · 200 SAR')}
                  </p>
                </div>
                {reqStatus === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleVerify(r.user_id)} className="px-3 py-1.5 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-bold flex items-center gap-1 transition-colors">
                      <Check size={14} /> {lang === 'ar' ? 'موافقة' : 'Approve'}
                    </button>
                    <button onClick={() => handleReject(r.id)} className="px-3 py-1.5 rounded-full border border-red-500/40 text-red-500 hover:bg-red-500/10 text-sm font-bold flex items-center gap-1 transition-colors">
                      <X size={14} /> {lang === 'ar' ? 'رفض' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </Layout>
  );
};

export default Admin;
