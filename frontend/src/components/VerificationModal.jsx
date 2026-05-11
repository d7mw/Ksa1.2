import React, { useState } from 'react';
import { X, BadgeCheck, Check, Loader2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { usersApi } from '../api';

const VerificationModal = ({ open, onClose }) => {
  const { lang } = useApp();
  const [plan, setPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await usersApi.requestVerification(plan);
      setSuccess(true);
      setTimeout(() => onClose?.(true), 1800);
    } catch (err) {
      setError(err.response?.data?.detail || (lang === 'ar' ? 'تعذر إرسال الطلب' : 'Request failed'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={() => onClose?.()}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0a100d] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <BadgeCheck className="text-green-500" size={22} />
            {lang === 'ar' ? 'طلب التوثيق' : 'Request verification'}
          </h2>
          <button onClick={() => onClose?.()} className="p-2 rounded-full hover:bg-white/5"><X size={20} /></button>
        </header>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/15 mx-auto flex items-center justify-center mb-4">
              <Check size={32} className="text-green-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">{lang === 'ar' ? 'تم إرسال طلبك' : 'Request submitted'}</h3>
            <p className="text-sm text-zinc-400">
              {lang === 'ar' ? 'سيتم مراجعة طلبك من فريق ksa1 وإخبارك بالنتيجة.' : 'The ksa1 team will review and notify you.'}
            </p>
          </div>
        ) : (
          <div className="p-5">
            <p className="text-sm text-zinc-400 mb-4">
              {lang === 'ar' ? 'اختر الباقة المناسبة للحصول على علامة التوثيق الخضراء.' : 'Choose your plan to get the green verification badge.'}
            </p>

            <div className="space-y-3">
              {[
                { id: 'monthly', price: 25, label: lang === 'ar' ? 'شهري' : 'Monthly', sub: lang === 'ar' ? '25 ريال سعودي / الشهر' : '25 SAR / month' },
                { id: 'yearly', price: 200, label: lang === 'ar' ? 'سنوي (توفير 33%)' : 'Yearly (save 33%)', sub: lang === 'ar' ? '200 ريال سعودي / السنة' : '200 SAR / year' },
              ].map((p) => (
                <button key={p.id} onClick={() => setPlan(p.id)} className={`w-full text-start border rounded-2xl p-4 flex items-center justify-between transition-colors ${plan === p.id ? 'border-green-600 bg-green-600/5' : 'border-zinc-800 hover:bg-white/5'}`}>
                  <div>
                    <p className="font-bold">{p.label}</p>
                    <p className="text-sm text-zinc-400">{p.sub}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${plan === p.id ? 'border-green-500 bg-green-500' : 'border-zinc-600'}`}>
                    {plan === p.id && <Check size={14} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 text-xs text-zinc-500 bg-zinc-900/50 rounded-xl p-3">
              {lang === 'ar' ? '🔍 سيتم مراجعة طلبك يدوياً. ستصلك الفواتير بعد الموافقة على بريدك.' : '🔍 Your request will be reviewed manually. Billing instructions will be sent by email upon approval.'}
            </div>

            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

            <button onClick={submit} disabled={loading} className="btn-primary w-full py-3 rounded-full font-bold mt-4 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {lang === 'ar' ? 'إرسال الطلب' : 'Submit request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationModal;
