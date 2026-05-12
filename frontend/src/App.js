import { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import UserNotFound from './components/UserNotFound';
import Home from './pages/Home';
import Login from './pages/Login';
import Explore from './pages/Explore';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Conversation from './pages/Conversation';
import Profile from './pages/Profile';
import TweetDetail from './pages/TweetDetail';
import Bookmarks from './pages/Bookmarks';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import { isReservedPath, isValidUsernameFormat } from './utils/reservedPaths';

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

// Catch-all profile route. Handles:
// - Reserved paths (home, admin, etc.) → redirect to home (defensive)
// - Invalid handles (special chars) → friendly not-found
// - Valid handles → render Profile
const HandleRoute = () => {
  const params = useParams();
  const handle = params.handle;
  if (!handle) return <Navigate to="/home" replace />;
  if (isReservedPath(handle)) return <Navigate to={`/${handle.toLowerCase()}`} replace />;
  if (!isValidUsernameFormat(handle)) return <UserNotFound handle={handle} />;
  return <Profile />;
};

const AppShell = () => {
  const { user, authLoading } = useApp();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user && !authLoading ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* Explicit system routes (defined BEFORE catch-all to take priority) */}
      <Route path="/home" element={<Protected><Home /></Protected>} />
      <Route path="/explore" element={<Protected><Explore /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/messages" element={<Protected><Messages /></Protected>} />
      <Route path="/messages/:conversationId" element={<Protected><Conversation /></Protected>} />
      <Route path="/bookmarks" element={<Protected><Bookmarks /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="/tweet/:id" element={<Protected><TweetDetail /></Protected>} />

      {/* Legacy alias: /u/:username still works */}
      <Route path="/u/:username" element={<Protected><Profile /></Protected>} />

      {/* Catch-all: /:handle for user profiles (lowest priority) */}
      <Route path="/:handle" element={<Protected><HandleRoute /></Protected>} />

      {/* Fallback for anything else */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
};

function App() {
  useEffect(() => { document.title = 'ksa1'; }, []);
  return (
    <div className="App">
      <ErrorBoundary>
        <BrowserRouter>
          <AppProvider>
            <AppShell />
          </AppProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  );
}

export default App;
