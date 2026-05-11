import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LOGO_URL } from '../mock';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { Languages, Eye, EyeOff } from 'lucide-react';

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8c1.8-4.4 6.1-7.5 11.1-7.5 3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6.5 5.5c4.4-4 7.2-10 7.2-16.8 0-1.3-.1-2.7-.4-3.5z"/>
  </svg>
);

const Login = () => {
  const { lang, toggleLang, login } = useApp();
  const nav = useNavigate();
  const [mode, setMode] = useState('signin');
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });

  const submit = (e) => {
    e.preventDefault();
    // Mock login
    const u = {
      id: 'u_me',
      name: form.name || (lang === 'ar' ? 'أنت' : 'You'),
      username: form.username || form.email?.split('@')[0] || 'you',
      email: form.email,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
      cover: 'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=1200&h=400&fit=crop',
      bio: lang === 'ar' ? 'مستخدم جديد في ksa1' : 'New on ksa1',
      location: lang === 'ar' ? 'الرياض' : 'Riyadh',
      joined: lang === 'ar' ? 'يوليو 2025' : 'July 2025',
      following: 0,
      followers: 0,
      verified: false,
    };
    login(u);
    nav('/home');
  };

  const googleLogin = () => {
    const u = {
      id: 'u_me',
      name: lang === 'ar' ? 'مستخدم Google' : 'Google User',
      username: 'google_user',
      email: 'user@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
      cover: 'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=1200&h=400&fit=crop',
      bio: lang === 'ar' ? 'دخلت عبر Google' : 'Signed in with Google',
      location: 'Riyadh',
      joined: lang === 'ar' ? 'يوليو 2025' : 'July 2025',
      following: 0,
      followers: 0,
      verified: false,
    };
    login(u);
    nav('/home');
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-200px] start-[-150px] w-[600px] h-[600px] rounded-full bg-green-900/30 blur-3xl" />
        <div className="absolute bottom-[-200px] end-[-150px] w-[600px] h-[600px] rounded-full bg-emerald-900/20 blur-3xl" />
      </div>

      <button
        onClick={toggleLang}
        className="absolute top-5 end-5 z-10 flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 hover:bg-white/5 transition-colors text-sm"
      >
        <Languages size={16} />
        {lang === 'ar' ? 'English' : 'العربية'}
      </button>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 items-center">
          {/* Brand */}
          <div className="text-center md:text-start">
            <img src={LOGO_URL} alt="ksa1" className="w-28 h-28 rounded-3xl logo-glow mx-auto md:mx-0 object-cover" />
            <h1 className="mt-6 text-5xl md:text-6xl font-extrabold tracking-tight">
              {t(lang, 'welcome')} <span className="text-green-500">ksa1</span>
            </h1>
            <p className="mt-3 text-lg text-zinc-400 max-w-md md:max-w-sm">{t(lang, 'welcomeSubtitle')}</p>
          </div>

          {/* Form */}
          <div className="bg-[#0a100d] border border-zinc-900 rounded-3xl p-8 shadow-2xl shadow-green-950/30">
            <h2 className="text-2xl font-bold mb-6">
              {mode === 'signin' ? t(lang, 'signIn') : t(lang, 'createAccount')}
            </h2>

            <button
              onClick={googleLogin}
              className="btn-outline w-full py-3 rounded-full font-semibold flex items-center justify-center gap-3 bg-white text-black hover:bg-zinc-100 border-transparent"
            >
              <GoogleIcon />
              <span>{t(lang, 'signInWith')} {t(lang, 'google')}</span>
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-500">{t(lang, 'or')}</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <input
                    type="text"
                    placeholder={t(lang, 'name')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
                  />
                  <input
                    type="text"
                    placeholder={t(lang, 'username')}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
                  />
                </>
              )}
              <input
                type="email"
                placeholder={t(lang, 'email')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
              />
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder={t(lang, 'password')}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-zinc-500 hover:text-zinc-300"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button type="submit" className="btn-primary w-full py-3 rounded-full font-bold text-base mt-2">
                {mode === 'signin' ? t(lang, 'signIn') : t(lang, 'createAccount')}
              </button>
            </form>

            <p className="text-sm text-zinc-500 mt-5 text-center">
              {mode === 'signin' ? t(lang, 'noAccount') : t(lang, 'haveAccount')}
              {' '}
              <button
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-green-500 font-semibold hover:underline"
              >
                {mode === 'signin' ? t(lang, 'signUp') : t(lang, 'signIn')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
