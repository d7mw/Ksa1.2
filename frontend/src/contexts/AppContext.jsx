import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, tweetsApi, usersApi, setToken, getToken } from '../api';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('ksa1_lang') || 'ar');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tweets, setTweets] = useState([]);
  const [tweetsLoading, setTweetsLoading] = useState(false);
  const [feedTab, setFeedTab] = useState('forYou');

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('ksa1_lang', lang);
  }, [lang]);

  // Load current user from token
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    authApi.me()
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const refreshFeed = useCallback(async (tab = feedTab) => {
    setTweetsLoading(true);
    try {
      const data = await tweetsApi.feed(tab);
      setTweets(data);
    } catch (e) {
      console.error('feed error', e);
    } finally {
      setTweetsLoading(false);
    }
  }, [feedTab]);

  useEffect(() => {
    if (user) refreshFeed(feedTab);
  }, [user, feedTab, refreshFeed]);

  const onAuthSuccess = ({ token, user: u }) => {
    setToken(token);
    setUser(u);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTweets([]);
  };

  const toggleLang = () => setLang((l) => (l === 'ar' ? 'en' : 'ar'));

  const updateUser = async (data) => {
    const u = await usersApi.updateMe(data);
    setUser((cur) => ({ ...cur, ...u }));
    return u;
  };

  const createTweet = async (content, image, parent_id) => {
    const tw = await tweetsApi.create({ content, image, parent_id });
    if (!parent_id) setTweets((arr) => [tw, ...arr]);
    return tw;
  };

  const toggleLike = async (tweetId) => {
    // Optimistic update
    setTweets((arr) =>
      arr.map((t) =>
        t.id === tweetId
          ? { ...t, liked: !t.liked, likes_count: t.liked ? t.likes_count - 1 : t.likes_count + 1 }
          : t
      )
    );
    try {
      await tweetsApi.like(tweetId);
    } catch (e) {
      // revert on error
      setTweets((arr) =>
        arr.map((t) =>
          t.id === tweetId
            ? { ...t, liked: !t.liked, likes_count: t.liked ? t.likes_count - 1 : t.likes_count + 1 }
            : t
        )
      );
    }
  };

  const deleteTweet = async (tweetId) => {
    await tweetsApi.delete(tweetId);
    setTweets((arr) => arr.filter((t) => t.id !== tweetId));
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        user,
        setUser,
        authLoading,
        onAuthSuccess,
        logout,
        updateUser,
        tweets,
        tweetsLoading,
        refreshFeed,
        feedTab,
        setFeedTab,
        createTweet,
        toggleLike,
        deleteTweet,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
