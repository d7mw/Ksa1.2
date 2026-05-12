import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../api';
import { Lock, Mail, LogOut, Languages, ChevronRight, Loader2, ShieldCheck, MessageSquare } from 'lucide-react';

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    role="switch"
    aria-checked={checked}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
      checked ? 'bg-green-500' : 'bg-zinc-700'
    } ${disabled ? 'opacity-50' : ''}`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
        checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5 rtl:-translate-x-0.5'
      }`}
    />
  </button>
);

const Row = ({ icon: Icon, title, desc, right, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/5 transition-colors border-b border-zinc-900 text-start"
  >
    {Icon && <Icon size={20} className="text-zinc-400 flex-shrink-0" />}
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-[15px]">{title}</p>
      {desc && <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>}
    </div>
    {right}
  </button>
);

const Settings = () => {
  const { lang, toggleLang, user, setUser, logout } = useApp();
  const nav = useNavigate();
  const [savingPriv, setSavingPriv] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingDm, setSavingDm] = useState(false);

  if (!user) {
    nav('/login');
    return null;
  }

  const togglePrivate = async () => {
    if (savingPriv) return;
    const next = !user.is_private;
    setSavingPriv(true);
    setUser((u) => u ? { ...u, is_private: next } : u);
    try {
      const updated = await usersApi.updateMe({ is_private: next });
      setUser((u) => u ? { ...u, ...updated } : u);
    } catch (e) {
      setUser((u) => u ? { ...u, is_private: !next } : u);
    } finally { setSavingPriv(false); }
  };

  const toggleEmailNotif = async () => {
    if (savingEmail) return;
    const next = !user.email_notifications_disabled;
    setSavingEmail(true);
    setUser((u) => u ? { ...u, email_notifications_disabled: next } : u);
    try {
      const updated = await usersApi.updateMe({ email_notifications_disabled: next });
      setUser((u) => u ? { ...u, ...updated } : u);
    } catch (e) {
      setUser((u) => u ? { ...u, email_notifications_disabled: !next } : u);
    } finally { setSavingEmail(false); }
  };

  const setDmPrivacy = async (value) => {
    if (savingDm) return;
    const prev = user.dm_privacy || 'everyone';
    if (prev === value) return;
    setSavingDm(true);
    setUser((u) => u ? { ...u, dm_privacy: value } : u);
    try {
      const updated = await usersApi.updateMe({ dm_privacy: value });
      setUser((u) => u ? { ...u, ...updated } : u);
    } catch (e) {
      setUser((u) => u ? { ...u, dm_privacy: prev } : u);
    } finally { setSavingDm(false); }
  };

  const handleLogout = () => {
    if (!window.confirm(lang === 'ar' ? 'هل تريد تسجيل الخروج؟' : 'Sign out from ksa1?')) return;
    logout();
    nav('/login');
  };

  return (
    <Layout>
      <header className="sticky top-0 z-20 bg-black/70 backdrop-blur-md border-b border-zinc-900 px-4 py-3">
        <h1 className="text-xl font-extrabold">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</h1>
        <p className="text-xs text-zinc-500">@{user.username}</p>
      </header>

      {/* Privacy section */}
      <section>
        <h2 className="px-4 pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          {lang === 'ar' ? 'الخصوصية' : 'Privacy'}
        </h2>
        <Row
          icon={Lock}
          title={lang === 'ar' ? 'حساب خاص' : 'Private account'}
          desc={lang === 'ar'
            ? 'لن تظهر تغريداتك إلا للمتابِعين الذين توافق عليهم.'
            : 'Only your approved followers can see your tweets.'}
          right={
            savingPriv
              ? <Loader2 size={18} className="animate-spin text-green-500" />
              : <Toggle checked={!!user.is_private} onChange={togglePrivate} disabled={savingPriv} />
          }
        />
        <div className="px-4 py-4 border-b border-zinc-900">
          <div className="flex items-start gap-4">
            <MessageSquare size={20} className="text-zinc-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-[15px]">{lang === 'ar' ? 'من يمكنه مراسلتك مباشرة' : 'Who can message you'}</p>
              <p className="text-xs text-zinc-500 mt-0.5 mb-3">
                {lang === 'ar' ? 'تحكم في الرسائل الخاصة الواردة.' : 'Control who can DM you directly.'}
              </p>
              <div className="flex gap-2" data-testid="dm-privacy-selector">
                {[
                  { v: 'everyone', label: lang === 'ar' ? 'الجميع' : 'Everyone' },
                  { v: 'followers', label: lang === 'ar' ? 'المتابعون فقط' : 'Followers only' },
                ].map((opt) => {
                  const active = (user.dm_privacy || 'everyone') === opt.v;
                  return (
                    <button
                      key={opt.v}
                      data-testid={`dm-privacy-${opt.v}`}
                      onClick={() => setDmPrivacy(opt.v)}
                      disabled={savingDm}
                      className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${active ? 'bg-green-600 text-white border-green-600' : 'bg-transparent text-zinc-300 border-zinc-700 hover:border-zinc-500'}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {savingDm && <Loader2 size={16} className="self-center animate-spin text-green-500" />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="px-4 pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          {lang === 'ar' ? 'الإشعارات' : 'Notifications'}
        </h2>
        <Row
          icon={Mail}
          title={lang === 'ar' ? 'إيقاف إشعارات البريد' : 'Disable email notifications'}
          desc={lang === 'ar'
            ? 'لن تصلك رسائل بريد عند المتابعة الجديدة.'
            : "You won't receive emails when someone follows you."}
          right={
            savingEmail
              ? <Loader2 size={18} className="animate-spin text-green-500" />
              : <Toggle checked={!!user.email_notifications_disabled} onChange={toggleEmailNotif} disabled={savingEmail} />
          }
        />
      </section>

      {/* General */}
      <section>
        <h2 className="px-4 pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          {lang === 'ar' ? 'عام' : 'General'}
        </h2>
        <Row
          icon={Languages}
          title={lang === 'ar' ? 'اللغة' : 'Language'}
          desc={lang === 'ar' ? 'العربية / English' : 'English / العربية'}
          right={
            <span className="flex items-center gap-2 text-sm text-zinc-400">
              <span>{lang === 'ar' ? 'العربية' : 'English'}</span>
              <ChevronRight size={16} className="flip-rtl" />
            </span>
          }
          onClick={toggleLang}
        />
        <Row
          icon={ShieldCheck}
          title={lang === 'ar' ? 'الملف الشخصي' : 'Edit profile'}
          desc={lang === 'ar' ? 'الاسم، الصورة، البنر، النبذة' : 'Name, avatar, banner, bio'}
          right={<ChevronRight size={16} className="text-zinc-500 flip-rtl" />}
          onClick={() => nav('/profile')}
        />
      </section>

      {/* Account */}
      <section className="mb-10">
        <h2 className="px-4 pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          {lang === 'ar' ? 'الحساب' : 'Account'}
        </h2>
        <Row
          icon={LogOut}
          title={<span className="text-red-400">{lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>}
          desc={lang === 'ar' ? 'انهاء الجلسة من هذا الجهاز' : 'End your session on this device'}
          right={<ChevronRight size={16} className="text-red-400 flip-rtl" />}
          onClick={handleLogout}
        />
      </section>
    </Layout>
  );
};

export default Settings;
