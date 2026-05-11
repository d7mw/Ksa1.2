import React, { useRef, useState } from 'react';
import { Image, Smile, MapPin, Calendar, BarChart2, Globe, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { t } from '../i18n';

const ComposeTweet = ({ onPosted, compact = false }) => {
  const { lang, user, addTweet, getUserById } = useApp();
  const me = user || getUserById('u_me');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const fileRef = useRef(null);
  const max = 280;

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!content.trim() && !image) return;
    addTweet(content.trim(), image);
    setContent('');
    setImage(null);
    if (fileRef.current) fileRef.current.value = '';
    onPosted?.();
  };

  const remaining = max - content.length;
  const overLimit = remaining < 0;

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-zinc-900">
      <img src={me.avatar} alt={me.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
      <div className="flex-1">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t(lang, 'whatsHappening')}
          rows={compact ? 2 : 3}
          className="w-full bg-transparent text-xl placeholder-zinc-500 resize-none outline-none py-2"
        />

        {image && (
          <div className="relative mt-2 rounded-2xl overflow-hidden border border-zinc-800">
            <button
              onClick={() => setImage(null)}
              className="absolute top-2 end-2 bg-black/70 hover:bg-black p-1.5 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
            <img src={image} alt="preview" className="w-full max-h-[400px] object-cover" />
          </div>
        )}

        <button className="flex items-center gap-1 mt-2 text-green-500 text-sm font-semibold hover:bg-green-500/10 px-2 py-1 rounded-full transition-colors">
          <Globe size={14} />
          <span>{t(lang, 'everyone')}</span>
        </button>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-900">
          <div className="flex items-center gap-1 text-green-500">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-full hover:bg-green-500/10 transition-colors"
              title={t(lang, 'photo')}
            >
              <Image size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors">
              <BarChart2 size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors">
              <Smile size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors">
              <Calendar size={18} />
            </button>
            <button className="p-2 rounded-full hover:bg-green-500/10 transition-colors">
              <MapPin size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {content.length > 0 && (
              <span className={`text-sm ${overLimit ? 'text-red-500' : remaining < 20 ? 'text-amber-500' : 'text-zinc-500'}`}>
                {remaining}
              </span>
            )}
            <button
              onClick={submit}
              disabled={(!content.trim() && !image) || overLimit}
              className="btn-primary px-5 py-1.5 rounded-full font-bold text-sm"
            >
              {t(lang, 'post')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeTweet;
