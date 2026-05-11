import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LOGO_URL } from '../mock';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { Languages, Eye, EyeOff, ArrowLeft, Mail, Loader2, KeyRound } from 'lucide-react';
import { authApi } from '../api';

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8c1.8-4.4 6.1-7.5 11.1-7.5 3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6.5 5.5c4.4-4 7.2-10 7.2-16.8 0-1.3-.1-2.7-.4-3.5z"/>
  </svg>
);

const ERROR_MESSAGES = {
  ar: {
    email_taken: 'البريد مسجل مسبقاً',
    username_taken: 'اسم المستخدم محجوز من شخص آخر',
    invalid_credentials: 'البريد أو كلمة المرور غير صحيحة',
    invalid_code: 'الرمز غير صحيح',
    otp_not_found: 'انتهت صلاحية الرمز، حاول من جديد',
    too_many_attempts: 'محاولات كثيرة فاشلة',
    email_not_verified: 'حسابك غير مفعّل',
    account_banned: 'الحساب محظور',
    use_google_login: 'استخدم تسجيل Google',
    invalid_format: 'اسم المستخدم: 3-20 حرف (أحرف وأرقام و _)',
    network: 'تعذر الاتصال بالخادم',
  },
  en: {
    email_taken: 'Email already registered',
    username_taken: 'Username already taken',
    invalid_credentials: 'Wrong email or password',
    invalid_code: 'Invalid code',
    otp_not_found: 'Code expired. Try again.',
    too_many_attempts: 'Too many failed attempts',
    email_not_verified: 'Account not verified',
    account_banned: 'Account banned',
    use_google_login: 'Use Google sign in',
    invalid_format: 'Username: 3-20 chars (letters, digits, _)',
    network: 'Could not reach server',
  },
};

const Login = () => {
  const { lang, toggleLang, onAuthSuccess } = useApp();
  const nav = useNavigate();
  const [mode, setMode] = useState('signin'); // signin | signup | verify | forgot | forgot-verify
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', code: '', new_password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [forgotInfo, setForgotInfo] = useState('');

  const errMsg = (key) => ERROR_MESSAGES[lang][key] || key;

  const checkUsername = async (value) => {
    if (value.length < 3) { setUsernameStatus(null); return; }
    try {
      const r = await authApi.checkUsername(value);
      setUsernameStatus(r);
    } catch {
      setUsernameStatus(null);
    }
  };

  const handleUsernameChange = (v) => {
    const clean = v.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
    setForm({ ...form, username: clean });
    clearTimeout(window.__unameTimer);
    window.__unameTimer = setTimeout(() => checkUsername(clean), 350);
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login({ email: form.email.trim(), password: form.password });
      onAuthSuccess(data);
      nav('/home');
    } catch (err) {
      setError(errMsg(err.response?.data?.detail || 'network'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStart = async (e) => {
    e.preventDefault();
    setError('');
    if (usernameStatus && !usernameStatus.available) {
      setError(errMsg(usernameStatus.reason || 'username_taken'));
      return;
    }
    setLoading(true);
    try {
      await authApi.signupStart({
        name: form.name.trim(),
        username: form.username,
        email: form.email.trim(),
        password: form.password,
      });
      setMode('verify');
    } catch (err) {
      setError(errMsg(err.response?.data?.detail || 'network'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.signupVerify({ email: form.email.trim(), code: form.code });
      onAuthSuccess(data);
      nav('/home');
    } catch (err) {
      setError(errMsg(err.response?.data?.detail || 'network'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'forgot-verify') {
        await authApi.forgotStart(form.email.trim());
      } else {
        await authApi.signupStart({
          name: form.name.trim(),
          username: form.username,
          email: form.email.trim(),
          password: form.password,
        });
      }
    } catch (err) {
      setError(errMsg(err.response?.data?.detail || 'network'));
    } finally { setLoading(false); }
  };

  const handleForgotStart = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotStart(form.email.trim());
      setForgotInfo(lang === 'ar'
        ? 'إذا كان البريد مسجلاً، سيصلك رمز إعادة التعيين خلال ثواني.'
        : 'If the email is registered, a reset code is on its way.');
      setMode('forgot-verify');
    } catch (err) {
      setError(errMsg(err.response?.data?.detail || 'network'));
    } finally { setLoading(false); }
  };

  const handleForgotVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.forgotVerify({
        email: form.email.trim(),
        code: form.code,
        new_password: form.new_password,
      });
      onAuthSuccess(data);
      nav('/home');
    } catch (err) {
      setError(errMsg(err.response?.data?.detail || 'network'));
    } finally { setLoading(false); }
  };

  const googleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Simple Google OAuth via Google Identity Services prompt
      // For MVP we use a quick mock-like flow that hits backend; the backend trusts the email.
      // In production this should be replaced with a verified Google ID token.
      const email = window.prompt(lang === 'ar' ? 'أدخل إيميل Google الخاص بك' : 'Enter your Google email');
      if (!email) { setLoading(false); return; }
      const name = window.prompt(lang === 'ar' ? 'أدخل الاسم الكامل' : 'Enter your full name', email.split('@')[0]) || email.split('@')[0];
      const data = await authApi.google({ name, email, avatar: '' });
      onAuthSuccess(data);
      nav('/home');
    } catch (err) {
      setError(errMsg(err.response?.data?.detail || 'network'));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 relative overflow-hidden">
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
          <div className="text-center md:text-start">
            <img src={LOGO_URL} alt="ksa1" className="w-28 h-28 rounded-3xl logo-glow mx-auto md:mx-0 object-cover" />
            <h1 className="mt-6 text-5xl md:text-6xl font-extrabold tracking-tight">
              {t(lang, 'welcome')} <span className="text-green-500">ksa1</span>
            </h1>
            <p className="mt-3 text-lg text-zinc-400 max-w-md md:max-w-sm">{t(lang, 'welcomeSubtitle')}</p>
          </div>

          <div className="bg-[#0a100d] border border-zinc-900 rounded-3xl p-8 shadow-2xl shadow-green-950/30">
            {mode === 'verify' ? (
              <>
                <button onClick={() => setMode('signup')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 text-sm">
                  <ArrowLeft size={16} className="flip-rtl" /> {lang === 'ar' ? 'رجوع' : 'Back'}
                </button>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-3">
                    <Mail size={28} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold">{lang === 'ar' ? 'تحقق من بريدك' : 'Verify your email'}</h2>
                  <p className="text-sm text-zinc-400 mt-2">
                    {lang === 'ar' ? `أرسلنا رمزاً إلى ${form.email}` : `Sent a code to ${form.email}`}
                  </p>
                </div>
                <form onSubmit={handleVerify} className="space-y-4">
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-4 outline-none text-center text-3xl tracking-[0.5em] font-bold transition-colors"
                  />
                  {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                  <button type="submit" disabled={loading || form.code.length !== 6} className="btn-primary w-full py-3 rounded-full font-bold">
                    {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (lang === 'ar' ? 'تحقق' : 'Verify')}
                  </button>
                  <button type="button" onClick={handleResend} disabled={loading} className="w-full text-sm text-green-500 hover:underline">
                    {lang === 'ar' ? 'إعادة إرسال الرمز' : 'Resend code'}
                  </button>
                </form>
              </>
            ) : mode === 'forgot' ? (
              <>
                <button onClick={() => { setMode('signin'); setError(''); }} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 text-sm">
                  <ArrowLeft size={16} className="flip-rtl" /> {lang === 'ar' ? 'رجوع لتسجيل الدخول' : 'Back to sign in'}
                </button>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-3">
                    <KeyRound size={28} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold">{lang === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</h2>
                  <p className="text-sm text-zinc-400 mt-2">
                    {lang === 'ar' ? 'أدخل بريدك المسجل لإرسال رمز إعادة التعيين.' : 'Enter your registered email to receive a reset code.'}
                  </p>
                </div>
                <form onSubmit={handleForgotStart} className="space-y-3">
                  <input
                    type="email"
                    placeholder={t(lang, 'email')}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    autoFocus
                    className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
                  />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-full font-bold">
                    {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (lang === 'ar' ? 'إرسال الرمز' : 'Send code')}
                  </button>
                </form>
              </>
            ) : mode === 'forgot-verify' ? (
              <>
                <button onClick={() => setMode('forgot')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 text-sm">
                  <ArrowLeft size={16} className="flip-rtl" /> {lang === 'ar' ? 'رجوع' : 'Back'}
                </button>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-3">
                    <KeyRound size={28} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold">{lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset password'}</h2>
                  {forgotInfo && <p className="text-xs text-green-500 mt-2">{forgotInfo}</p>}
                  <p className="text-sm text-zinc-400 mt-2">
                    {lang === 'ar' ? `الرمز أُرسل إلى ${form.email}` : `Code sent to ${form.email}`}
                  </p>
                </div>
                <form onSubmit={handleForgotVerify} className="space-y-3">
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none text-center text-2xl tracking-[0.4em] font-bold transition-colors"
                  />
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New password'}
                      value={form.new_password}
                      onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                      required
                      minLength={6}
                      className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
                    />
                    <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute top-1/2 -translate-y-1/2 end-3 text-zinc-500 hover:text-zinc-300">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button type="submit" disabled={loading || form.code.length !== 6 || form.new_password.length < 6} className="btn-primary w-full py-3 rounded-full font-bold">
                    {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (lang === 'ar' ? 'تعيين كلمة المرور' : 'Set new password')}
                  </button>
                  <button type="button" onClick={handleResend} disabled={loading} className="w-full text-sm text-green-500 hover:underline">
                    {lang === 'ar' ? 'إعادة إرسال الرمز' : 'Resend code'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-6">
                  {mode === 'signin' ? t(lang, 'signIn') : t(lang, 'createAccount')}
                </h2>

                <button onClick={googleLogin} disabled={loading}
                  className="w-full py-3 rounded-full font-semibold flex items-center justify-center gap-3 bg-white text-black hover:bg-zinc-100 transition-colors">
                  <GoogleIcon />
                  <span>{t(lang, 'signInWith')} {t(lang, 'google')}</span>
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs text-zinc-500">{t(lang, 'or')}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                <form onSubmit={mode === 'signin' ? handleSignin : handleSignupStart} className="space-y-3">
                  {mode === 'signup' && (
                    <>
                      <input
                        type="text"
                        placeholder={t(lang, 'name')}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        maxLength={50}
                        className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
                      />
                      <div>
                        <div className="relative">
                          <span className="absolute top-1/2 -translate-y-1/2 start-3 text-zinc-500">@</span>
                          <input
                            type="text"
                            placeholder={t(lang, 'username')}
                            value={form.username}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            required
                            minLength={3}
                            maxLength={20}
                            className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl ps-8 pe-4 py-3 outline-none transition-colors"
                          />
                        </div>
                        {form.username.length >= 3 && usernameStatus && (
                          <p className={`text-xs mt-1 ${usernameStatus.available ? 'text-green-500' : 'text-red-500'}`}>
                            {usernameStatus.available
                              ? (lang === 'ar' ? '✓ الاسم متاح' : '✓ Available')
                              : errMsg(usernameStatus.reason || 'username_taken')}
                          </p>
                        )}
                      </div>
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
                      minLength={6}
                      className="w-full bg-[#0c1410] border border-zinc-800 focus:border-green-600 rounded-xl px-4 py-3 outline-none transition-colors"
                    />
                    <button type="button" onClick={() => setShowPwd((s) => !s)}
                      className="absolute top-1/2 -translate-y-1/2 end-3 text-zinc-500 hover:text-zinc-300">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {mode === 'signin' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-sm text-green-500 hover:underline">
                        {lang === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                      </button>
                    </div>
                  )}

                  {error && <p className="text-red-500 text-sm">{error}</p>}

                  <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-full font-bold text-base mt-2">
                    {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (mode === 'signin' ? t(lang, 'signIn') : t(lang, 'createAccount'))}
                  </button>
                </form>

                <p className="text-sm text-zinc-500 mt-5 text-center">
                  {mode === 'signin' ? t(lang, 'noAccount') : t(lang, 'haveAccount')}
                  {' '}
                  <button
                    onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                    className="text-green-500 font-semibold hover:underline"
                  >
                    {mode === 'signin' ? t(lang, 'signUp') : t(lang, 'signIn')}
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
