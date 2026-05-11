import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Home, UserX } from 'lucide-react';
import Layout from './Layout';
import { useApp } from '../contexts/AppContext';
import { LOGO_URL } from '../mock';

const UserNotFound = ({ handle }) => {
  const { lang } = useApp();
  const nav = useNavigate();

  return (
    <Layout>
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="relative mb-6">
          <img src={LOGO_URL} alt="ksa1" className="w-20 h-20 rounded-2xl object-cover opacity-70" />
          <div className="absolute -bottom-2 -end-2 w-10 h-10 rounded-full bg-red-500/20 border-2 border-black flex items-center justify-center">
            <UserX size={20} className="text-red-400" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
          {lang === 'ar' ? 'هذا الحساب غير موجود' : "This account doesn't exist"}
        </h1>

        {handle && (
          <p className="text-zinc-500 mb-2 break-all">
            @<span className="font-mono">{handle}</span>
          </p>
        )}

        <p className="text-zinc-400 max-w-md mb-8">
          {lang === 'ar'
            ? 'ابحث عن اسم آخر أو عُد للرئيسية.'
            : 'Try searching for a different name or head back home.'}
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => nav('/explore')}
            className="btn-outline px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2"
          >
            <Search size={16} />
            {lang === 'ar' ? 'ابحث عن أشخاص' : 'Search for people'}
          </button>
          <Link
            to="/home"
            className="btn-primary px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2"
          >
            <Home size={16} />
            {lang === 'ar' ? 'الرئيسية' : 'Home'}
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default UserNotFound;
