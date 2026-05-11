import React, { useRef, useState } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { authApi } from '../api';
import { compressImage } from '../utils/imageCompress';
import { getReadableError } from '../utils/errors';

const EditProfileModal = ({ open, onClose }) => {
  const { lang, user, updateUser } = useApp();
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    location: user?.location || '',
    avatar: user?.avatar || '',
    cover: user?.cover || '',
  });
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  React.useEffect(() => {
    if (open && user) {
      setForm({
        name: user.name || '',
        username: user.username || '',
        bio: user.bio || '',
        location: user.location || '',
        avatar: user.avatar || '',
        cover: user.cover || '',
      });
      setError('');
      setUsernameStatus(null);
    }
  }, [open, user]);

  if (!open) return null;

  const pickImage = (ref) => ref.current?.click();

  const handleFile = async (e, key) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(lang === 'ar' ? 'الملف ليس صورة' : 'Not an image');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError(lang === 'ar' ? 'الحجم الأقصى 15 ميجا' : 'Max 15MB');
      return;
    }
    setError('');
    try {
      const opts = key === 'avatar' ? { maxDimension: 600, targetBytes: 400_000 } : { maxDimension: 1600, targetBytes: 900_000 };
      const dataUrl = await compressImage(file, opts);
      setForm((f) => ({ ...f, [key]: dataUrl }));
    } catch (err) {
      setError(lang === 'ar' ? 'تعذر معالجة الصورة' : 'Failed to process image');
    }
  };

  const handleUsernameChange = (v) => {
    const clean = v.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
    setForm({ ...form, username: clean });
    clearTimeout(window.__editUnameTimer);
    if (clean === user.username || clean.length < 3) { setUsernameStatus(null); return; }
    window.__editUnameTimer = setTimeout(async () => {
      try {
        const r = await authApi.checkUsername(clean);
        setUsernameStatus(r);
      } catch { setUsernameStatus(null); }
    }, 350);
  };

  const save = async () => {
    if (!form.name.trim() || !form.username.trim()) return;
    if (usernameStatus && !usernameStatus.available) {
      setError(lang === 'ar' ? 'اسم المستخدم غير متاح' : 'Username not available');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateUser({
        name: form.name.trim(),
        username: form.username,
        bio: form.bio.trim(),
        location: form.location.trim(),
        avatar: form.avatar,
        cover: form.cover,
      });
      onClose?.(true);
    } catch (err) {
      setError(getReadableError(err, lang, lang === 'ar' ? 'تعذر الحفظ' : 'Failed to save'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={() => onClose?.()}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0a100d] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl mt-8">
        <header className="sticky top-0 bg-[#0a100d]/95 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 py-3 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => onClose?.()} className="p-2 rounded-full hover:bg-white/5 transition-colors"><X size={20} /></button>
            <h2 className="text-xl font-extrabold">{lang === 'ar' ? 'تعديل الملف' : 'Edit profile'}</h2>
          </div>
          <button onClick={save} disabled={loading || !form.name.trim() || !form.username.trim()} className="btn-primary px-5 py-1.5 rounded-full font-bold text-sm flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {lang === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </header>

        <div className="relative h-48 bg-gradient-to-br from-green-900 to-emerald-700 overflow-hidden">
          {form.cover && <img src={form.cover} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => handleFile(e, 'cover')} className="hidden" />
            <button onClick={() => pickImage(coverRef)} className="p-3 rounded-full bg-black/60 hover:bg-black/80 transition-colors"><Camera size={20} /></button>
            {form.cover && (
              <button onClick={() => setForm((f) => ({ ...f, cover: '' }))} className="ms-3 p-3 rounded-full bg-black/60 hover:bg-black/80 transition-colors"><X size={20} /></button>
            )}
          </div>
        </div>

        <div className="relative px-4">
          <div className="relative -mt-16 w-32 h-32 rounded-full border-4 border-[#0a100d] overflow-hidden bg-zinc-800 group">
            {form.avatar ? (
              <img src={form.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500"><Camera size={28} /></div>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <input ref={avatarRef} type="file" accept="image/*" onChange={(e) => handleFile(e, 'avatar')} className="hidden" />
              <button onClick={() => pickImage(avatarRef)} className="p-2 rounded-full bg-black/60 hover:bg-black/80"><Camera size={18} /></button>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          <Field label={t(lang, 'name')} value={form.name} max={50} onChange={(v) => setForm({ ...form, name: v })} />
          <div>
            <Field label={t(lang, 'username')} value={form.username} max={20} prefix="@" onChange={handleUsernameChange} />
            {form.username.length >= 3 && form.username !== user?.username && usernameStatus && (
              <p className={`text-xs mt-1 px-2 ${usernameStatus.available ? 'text-green-500' : 'text-red-500'}`}>
                {usernameStatus.available ? (lang === 'ar' ? '✓ متاح' : '✓ Available') : (lang === 'ar' ? 'محجوز' : 'Taken')}
              </p>
            )}
          </div>
          <Field label={lang === 'ar' ? 'النبذة' : 'Bio'} value={form.bio} max={160} multiline onChange={(v) => setForm({ ...form, bio: v })} />
          <Field label={t(lang, 'location')} value={form.location} max={30} onChange={(v) => setForm({ ...form, location: v })} />
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, max, multiline, prefix }) => (
  <label className="block">
    <div className="relative border border-zinc-800 focus-within:border-green-600 rounded-xl bg-[#0c1410] px-3 pt-2 pb-1 transition-colors">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>{value.length}/{max}</span>
      </div>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-zinc-500">{prefix}</span>}
        {multiline ? (
          <textarea value={value} maxLength={max} rows={3} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent outline-none resize-none py-1 text-[15px]" />
        ) : (
          <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent outline-none py-1 text-[15px]" />
        )}
      </div>
    </div>
  </label>
);

export default EditProfileModal;
