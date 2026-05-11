// Safely extract a human-readable error string from any axios/fetch error.
// FastAPI 422 returns `detail` as an array of {type, loc, msg}; older endpoints return string.
// This guarantees we never render an object as a React child.

export const getErrorMessage = (err, fallback = '') => {
  if (!err) return fallback;
  // Already a plain string
  if (typeof err === 'string') return err;

  const data = err?.response?.data;
  if (data) {
    const detail = data.detail ?? data.message ?? data.error;
    return formatDetail(detail) || fallback || 'unknown_error';
  }

  if (err.message && typeof err.message === 'string') return err.message;
  return fallback || 'network_error';
};

const formatDetail = (detail) => {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const loc = Array.isArray(d.loc) ? d.loc.filter((x) => x !== 'body').join('.') : '';
          const msg = d.msg || d.message || d.type || '';
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(d);
      })
      .filter(Boolean)
      .join(' • ');
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || detail.error || JSON.stringify(detail);
  }
  return String(detail);
};

// Common backend error codes -> user-friendly translations
export const translateError = (code, lang = 'ar') => {
  const map = {
    ar: {
      email_taken: 'البريد مسجل مسبقاً',
      username_taken: 'اسم المستخدم محجوز',
      invalid_credentials: 'البريد أو كلمة المرور غير صحيحة',
      invalid_code: 'الرمز غير صحيح',
      otp_not_found: 'انتهت صلاحية الرمز، حاول من جديد',
      otp_expired: 'انتهت صلاحية الرمز',
      too_many_attempts: 'محاولات كثيرة فاشلة',
      email_not_verified: 'حسابك غير مفعّل',
      account_banned: 'الحساب محظور',
      use_google_login: 'استخدم تسجيل Google',
      invalid_format: 'صيغة غير صالحة',
      image_too_large: 'الصورة كبيرة جداً',
      tweet_not_found: 'التغريدة غير موجودة',
      user_not_found: 'المستخدم غير موجود',
      parent_not_found: 'التغريدة الأصلية غير موجودة',
      already_verified: 'الحساب موثّق بالفعل',
      already_requested: 'لديك طلب توثيق مسبق',
      cannot_follow_self: 'لا يمكنك متابعة نفسك',
      forbidden: 'غير مسموح',
      Forbidden: 'غير مسموح',
      'Admin only': 'للأدمن فقط',
      'Not authenticated': 'يجب تسجيل الدخول',
      'Token expired': 'انتهت جلستك، سجّل دخول مجدداً',
      'Invalid token': 'جلستك غير صالحة',
      network_error: 'تعذر الاتصال بالخادم',
      unknown_error: 'حدث خطأ غير متوقع',
    },
    en: {
      email_taken: 'Email already registered',
      username_taken: 'Username already taken',
      invalid_credentials: 'Wrong email or password',
      invalid_code: 'Invalid code',
      otp_not_found: 'Code expired. Try again.',
      otp_expired: 'Code expired',
      too_many_attempts: 'Too many failed attempts',
      email_not_verified: 'Account not verified',
      account_banned: 'Account banned',
      use_google_login: 'Use Google sign in',
      invalid_format: 'Invalid format',
      image_too_large: 'Image too large',
      tweet_not_found: 'Tweet not found',
      user_not_found: 'User not found',
      parent_not_found: 'Original tweet not found',
      already_verified: 'Account already verified',
      already_requested: 'You already requested verification',
      cannot_follow_self: "You can't follow yourself",
      forbidden: 'Forbidden',
      Forbidden: 'Forbidden',
      'Admin only': 'Admin only',
      'Not authenticated': 'Please sign in',
      'Token expired': 'Session expired, please sign in again',
      'Invalid token': 'Invalid session',
      network_error: 'Could not reach server',
      unknown_error: 'Something went wrong',
    },
  };
  return map[lang]?.[code] || map.ar[code] || code || '';
};

// Combined helper: get error -> translate
export const getReadableError = (err, lang = 'ar', fallback = '') => {
  const raw = getErrorMessage(err, fallback);
  return translateError(raw, lang) || raw || fallback;
};
