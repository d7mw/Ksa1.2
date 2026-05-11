import React, { createContext, useContext, useEffect, useState } from 'react';
import { tweets as mockTweets, currentUser as mockUser, users as mockUsers } from '../mock';

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('ksa1_lang') || 'ar');
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ksa1_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [tweets, setTweets] = useState(() => {
    const stored = localStorage.getItem('ksa1_tweets');
    return stored ? JSON.parse(stored) : mockTweets;
  });
  const [followingIds, setFollowingIds] = useState(() => {
    const stored = localStorage.getItem('ksa1_following');
    return stored ? JSON.parse(stored) : ['u1', 'u3'];
  });

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('ksa1_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (user) localStorage.setItem('ksa1_user', JSON.stringify(user));
    else localStorage.removeItem('ksa1_user');
  }, [user]);

  useEffect(() => {
    localStorage.setItem('ksa1_tweets', JSON.stringify(tweets));
  }, [tweets]);

  useEffect(() => {
    localStorage.setItem('ksa1_following', JSON.stringify(followingIds));
  }, [followingIds]);

  const login = (userData) => setUser(userData);
  const logout = () => setUser(null);
  const toggleLang = () => setLang((l) => (l === 'ar' ? 'en' : 'ar'));

  const addTweet = (content, image) => {
    if (!user) return;
    const newTweet = {
      id: `t_${Date.now()}`,
      userId: user.id,
      content,
      image,
      timestamp: lang === 'ar' ? 'الآن' : 'now',
      likes: 0,
      retweets: 0,
      replies: 0,
      views: 1,
      liked: false,
      retweeted: false,
      isMe: true,
    };
    setTweets((t) => [newTweet, ...t]);
  };

  const toggleLike = (tweetId) => {
    setTweets((arr) =>
      arr.map((t) =>
        t.id === tweetId
          ? { ...t, liked: !t.liked, likes: t.liked ? t.likes - 1 : t.likes + 1 }
          : t
      )
    );
  };

  const toggleRetweet = (tweetId) => {
    setTweets((arr) =>
      arr.map((t) =>
        t.id === tweetId
          ? { ...t, retweeted: !t.retweeted, retweets: t.retweeted ? t.retweets - 1 : t.retweets + 1 }
          : t
      )
    );
  };

  const toggleFollow = (userId) => {
    setFollowingIds((ids) =>
      ids.includes(userId) ? ids.filter((i) => i !== userId) : [...ids, userId]
    );
  };

  const getUserById = (id) => {
    if (user && id === user.id) return user;
    return mockUsers.find((u) => u.id === id) || mockUser;
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        user,
        login,
        logout,
        tweets,
        addTweet,
        toggleLike,
        toggleRetweet,
        followingIds,
        toggleFollow,
        getUserById,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
