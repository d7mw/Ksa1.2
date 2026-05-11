// Routes that must NEVER be treated as usernames.
// Keep in sync with /app/backend/schemas.py RESERVED_USERNAMES.
export const RESERVED_PATHS = new Set([
  'home', 'login', 'logout', 'signin', 'signup', 'register',
  'explore', 'notifications', 'messages', 'bookmarks', 'profile',
  'settings', 'admin', 'administrator', 'mod', 'moderator',
  'tweet', 'tweets', 'post', 'posts', 'status', 'statuses',
  'api', 'app', 'www', 'mail', 'email', 'support', 'help',
  'about', 'contact', 'terms', 'privacy', 'policy', 'tos',
  'search', 'discover', 'trending', 'topic', 'topics', 'tag', 'tags',
  'user', 'users', 'me', 'you', 'null', 'undefined', 'true', 'false',
  'ksa1', 'official', 'verified', 'staff', 'team', 'u',
]);

export const isReservedPath = (segment) => {
  if (!segment || typeof segment !== 'string') return true;
  return RESERVED_PATHS.has(segment.toLowerCase());
};

// Username format: 3-20 chars, letters/digits/underscore only
export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;

export const isValidUsernameFormat = (segment) => {
  if (!segment) return false;
  return USERNAME_REGEX.test(segment);
};
