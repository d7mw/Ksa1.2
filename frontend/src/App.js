import { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { Loader2 } from 'lucide-react';
import Home from './pages/Home';
import Login from './pages/Login';
import Explore from './pages/Explore';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import TweetDetail from './pages/TweetDetail';
import Bookmarks from './pages/Bookmarks';
import Admin from './pages/Admin';

const Protected = ({ children }) => {
  const { user, authLoading } = useApp();
  const loc = useLocation();
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-green-500 animate-spin" size={36} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
};

const AppShell = () => {
  const { user, authLoading } = useApp();
  return (
    <Routes>
      <Route path="/login" element={user && !authLoading ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Protected><Home /></Protected>} />
      <Route path="/explore" element={<Protected><Explore /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/messages" element={<Protected><Messages /></Protected>} />
      <Route path="/bookmarks" element={<Protected><Bookmarks /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/u/:username" element={<Protected><Profile /></Protected>} />
      <Route path="/tweet/:id" element={<Protected><TweetDetail /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
};

function App() {
  useEffect(() => { document.title = 'ksa1'; }, []);
  return (
    <div className="App">
      <BrowserRouter>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
