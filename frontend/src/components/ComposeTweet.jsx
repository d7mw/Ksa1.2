import React, { useRef, useState } from 'react';
import { Image, Smile, MapPin, Calendar, BarChart2, Globe, X, Loader2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';
import { compressImage } from '../utils/imageCompress';
import { getReadableError } from '../utils/errors';

const ComposeTweet = ({ parentId, onPosted, placeholder }) => {
  const { lang, user, createTweet } = useApp();
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const max = 280;

  const handleImage = async (e) => {
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
    setImageLoading(true);
    try {
      const dataUrl = await compressImage(file);
      setImage(dataUrl);
    } catch (err) {
      setError(lang === 'ar' ? 'تعذر معالجة الصورة' : 'Failed to process image');
    } finally {
      setImageLoading(false);
    }
  };

  const submit = async () => {
    if ((!content.trim() && !image) || loading) return;
    setLoading(true);
    setError('');
    try {
      const tw = await createTweet(content.trim(), image, parentId);
      setContent('');
      setImage(null);
      if (fileRef.current) fileRef.current.value = '';
      onPosted?.(tw);
    } catch (err) {
      const status = err.response?.status;
      let msg;
      if (status === 413) {
        msg = lang === 'ar' ? 'الصورة كبيرة جداً، جرّب صورة أصغر' : 'Image too large, try a smaller one';
      } else if (status === 401) {
        msg = lang === 'ar' ? 'انتهت جلستك، سجّل دخول مجدداً' : 'Session expired, sign in again';
      } else if (!err.response) {
        msg = lang === 'ar' ? 'تعذر الاتصال، تحقق من الإنترنت' : 'Network error';
      } else {
        msg = getReadableError(err, lang, lang === 'ar' ? 'تعذر النشر' : 'Failed to post');
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  const remaining = max - content.length;
  const overLimit = remaining < 0;

  return (
    <div className="flex gap-3 px-3 sm:px-4 py-3 border-b border-zinc-900 max-w-full overflow-hidden">
      <img src={user.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' fill=\'%231f2a24\'/></svg>'} alt={user.name} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover flex-shrink-0 bg-zinc-800" />
      <div className="flex-1 min-w-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder || t(lang, 'whatsHappening')}
          rows={2}
          className="w-full bg-transparent text-lg sm:text-xl placeholder-zinc-500 resize-none outline-none py-2"
        />
        {image && (
          <div className="relative mt-2 rounded-2xl overflow-hidden border border-zinc-800">
            <button onClick={() => setImage(null)} className="absolute top-2 end-2 bg-black/70 hover:bg-black p-1.5 rounded-full transition-colors">
              <X size={16} />
            </button>
            <img src={image} alt="preview" className="w-full max-h-[400px] object-cover" />
          </div>
        )}
        {imageLoading && (
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 size={14} className="animate-spin" />
            <span>{lang === 'ar' ? 'جاري معالجة الصورة...' : 'Processing image...'}</span>
          </div>
        )}
        {!parentId && (
          <button className="flex items-center gap-1 mt-2 text-green-500 text-sm font-semibold hover:bg-green-500/10 px-2 py-1 rounded-full transition-colors">
            <Globe size={14} />
            <span>{t(lang, 'everyone')}</span>
          </button>
        )}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-900">
          <div className="flex items-center gap-1 text-green-500">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="p-2 rounded-full hover:bg-green-500/10 transition-colors">
              <Image size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors"><BarChart2 size={18} /></button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors"><Smile size={18} /></button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors"><Calendar size={18} /></button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors"><MapPin size={18} /></button>
          </div>
          <div className="flex items-center gap-3">
            {content.length > 0 && (
              <span className={`text-sm ${overLimit ? 'text-red-500' : remaining < 20 ? 'text-amber-500' : 'text-zinc-500'}`}>{remaining}</span>
            )}
            <button onClick={submit} disabled={loading || (!content.trim() && !image) || overLimit} className="btn-primary px-5 py-1.5 rounded-full font-bold text-sm flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{parentId ? t(lang, 'reply') : t(lang, 'post')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeTweet;
