import React, { useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';

const EditProfileModal = ({ open, onClose }) => {
  const { lang, user, login } = useApp();
  const me = user || {};
  const [form, setForm] = useState({
    name: me.name || '',
    username: me.username || '',
    bio: me.bio || '',
    location: me.location || '',
    avatar: me.avatar || '',
    cover: me.cover || '',
  });
  const avatarRef = useRef(null);
  const coverRef = useRef(null);

  if (!open) return null;

  const pickImage = (ref) => ref.current?.click();

  const handleFile = (e, key) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(lang === 'ar' ? 'الحجم الأقصى 5 ميجا' : 'Max size 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, [key]: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.name.trim() || !form.username.trim()) return;
    const updated = {
      ...me,
      name: form.name.trim(),
      username: form.username.trim().replace(/^@/, '').replace(/\s+/g, '_'),
      bio: form.bio.trim(),
      location: form.location.trim(),
      avatar: form.avatar,
      cover: form.cover,
    };
    login(updated);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a100d] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl mt-8"
      >
        {/* Header */}
        <header className="sticky top-0 bg-[#0a100d]/95 backdrop-blur-md border-b border-zinc-900 flex items-center justify-between px-4 py-3 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/5 transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-extrabold">
              {lang === 'ar' ? 'تعديل الملف' : 'Edit profile'}
            </h2>
          </div>
          <button
            onClick={save}
            disabled={!form.name.trim() || !form.username.trim()}
            className="btn-primary px-5 py-1.5 rounded-full font-bold text-sm"
          >
            {lang === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </header>

        {/* Cover */}
        <div className="relative h-48 bg-gradient-to-br from-green-900 to-emerald-700 overflow-hidden">
          {form.cover && (
            <img src={form.cover} alt="cover" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e, 'cover')}
              className="hidden"
            />
            <button
              onClick={() => pickImage(coverRef)}
              className="p-3 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              title={lang === 'ar' ? 'تغيير الغلاف' : 'Change cover'}
            >
              <Camera size={20} />
            </button>
            {form.cover && (
              <button
                onClick={() => setForm((f) => ({ ...f, cover: '' }))}
                className="ms-3 p-3 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Avatar */}
        <div className="relative px-4">
          <div className="relative -mt-16 w-32 h-32 rounded-full border-4 border-[#0a100d] overflow-hidden bg-zinc-800">
            {form.avatar ? (
              <img src={form.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                <Camera size={28} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e, 'avatar')}
                className="hidden"
              />
              <button
                onClick={() => pickImage(avatarRef)}
                className="p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
              >
                <Camera size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-4 py-6 space-y-4">
          <Field
            label={t(lang, 'name')}
            value={form.name}
            max={50}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Field
            label={t(lang, 'username')}
            value={form.username}
            max={20}
            prefix="@"
            onChange={(v) => setForm({ ...form, username: v.replace(/[^A-Za-z0-9_]/g, '') })}
          />
          <Field
            label={lang === 'ar' ? 'النبذة' : 'Bio'}
            value={form.bio}
            max={160}
            multiline
            onChange={(v) => setForm({ ...form, bio: v })}
          />
          <Field
            label={t(lang, 'location')}
            value={form.location}
            max={30}
            onChange={(v) => setForm({ ...form, location: v })}
          />
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, max, multiline, prefix }) => {
  const len = value.length;
  return (
    <label className="block">
      <div className="relative border border-zinc-800 focus-within:border-green-600 rounded-xl bg-[#0c1410] px-3 pt-2 pb-1 transition-colors">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{label}</span>
          <span>{len}/{max}</span>
        </div>
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-zinc-500">{prefix}</span>}
          {multiline ? (
            <textarea
              value={value}
              maxLength={max}
              rows={3}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-transparent outline-none resize-none py-1 text-[15px]"
            />
          ) : (
            <input
              value={value}
              maxLength={max}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-transparent outline-none py-1 text-[15px]"
            />
          )}
        </div>
      </div>
    </label>
  );
};

export default EditProfileModal;
