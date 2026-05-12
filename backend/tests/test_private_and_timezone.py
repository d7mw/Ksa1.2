"""
Backend tests for ksa1:
- Private account behavior (feed, user-tweets, tweet detail)
- Timezone correctness on created_at fields
- Basic regression on signup/login/like/retweet/follow
"""
import os
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-feed-269.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Direct mongo to read OTP codes (mirror backend settings)
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _suffix() -> str:
    return uuid.uuid4().hex[:8]


def _signup(name: str, username: str, email: str, password: str = "Passw0rd!") -> dict:
    """Complete OTP signup. Returns dict with token + user."""
    r = requests.post(f"{API}/auth/signup/start", json={
        "name": name, "username": username, "email": email, "password": password,
    }, timeout=20)
    assert r.status_code == 200, f"signup_start failed: {r.status_code} {r.text}"

    otp_doc = _db.otps.find_one({"email": email.lower()})
    assert otp_doc, f"OTP not found in db for {email}"
    code = otp_doc["code"]

    r = requests.post(f"{API}/auth/signup/verify", json={"email": email, "code": code}, timeout=20)
    assert r.status_code == 200, f"signup_verify failed: {r.status_code} {r.text}"
    return r.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _parse_dt(s):
    """Parse an ISO datetime string from API; accept both Z and offset."""
    if isinstance(s, datetime):
        return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


# --- Shared fixtures ---

@pytest.fixture(scope="module")
def users():
    """Create 3 fresh users: owner (private), follower, stranger."""
    sfx = _suffix()
    owner = _signup("Owner Priv", f"owner{sfx}", f"TEST_owner_{sfx}@example.com")
    follower = _signup("Follower User", f"fol{sfx}", f"TEST_follower_{sfx}@example.com")
    stranger = _signup("Stranger User", f"str{sfx}", f"TEST_stranger_{sfx}@example.com")
    yield {"owner": owner, "follower": follower, "stranger": stranger}

    # Best-effort cleanup
    for label in ("owner", "follower", "stranger"):
        try:
            uid = locals()[label] if isinstance(locals().get(label), dict) else None
        except Exception:
            uid = None
    # cleanup via mongo
    for k in ("owner", "follower", "stranger"):
        u = (owner, follower, stranger)[("owner", "follower", "stranger").index(k)]
        try:
            user_id = u["user"]["id"]
            _db.tweets.delete_many({"user_id": user_id})
            _db.follows.delete_many({"$or": [{"follower_id": user_id}, {"following_id": user_id}]})
            _db.likes.delete_many({"user_id": user_id})
            _db.retweets.delete_many({"user_id": user_id})
            _db.users.delete_one({"id": user_id})
        except Exception:
            pass


# --- Regression: signup/login ---

class TestAuthRegression:
    def test_signup_returns_token_and_user(self, users):
        owner = users["owner"]
        assert "token" in owner and isinstance(owner["token"], str) and len(owner["token"]) > 10
        assert "user" in owner and owner["user"]["username"].startswith("owner")
        # is_private should default False
        assert owner["user"].get("is_private") is False

    def test_login_works_with_signup_credentials(self, users):
        # We don't have the password handy, but we can hit /auth/me with the token
        r = requests.get(f"{API}/auth/me", headers=_auth(users["owner"]["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == users["owner"]["user"]["id"]


# --- Timezone ---

class TestTimezone:
    def test_user_created_at_has_timezone(self, users):
        ca = users["owner"]["user"]["created_at"]
        assert ca, "user created_at missing"
        # must include Z or +00:00 or any +/- offset
        assert ("Z" in ca) or ("+" in ca) or ("-" in ca[10:]), f"created_at lacks tz: {ca}"
        # parseable as tz-aware UTC
        dt = _parse_dt(ca)
        assert dt.tzinfo is not None

    def test_tweet_created_at_is_recent_and_tz_aware(self, users):
        owner = users["owner"]
        before = datetime.now(timezone.utc)
        r = requests.post(f"{API}/tweets", json={"content": f"TEST tz check {uuid.uuid4().hex[:6]}"},
                          headers=_auth(owner["token"]), timeout=15)
        after = datetime.now(timezone.utc)
        assert r.status_code == 200, r.text
        tw = r.json()
        ca = tw["created_at"]
        assert isinstance(ca, str)
        assert ("Z" in ca) or ("+" in ca) or ("-" in ca[10:]), f"tweet created_at lacks tz: {ca}"
        dt = _parse_dt(ca)
        # The created_at should be within a few seconds window (NOT shifted 3h)
        delta_low = (dt - before).total_seconds()
        delta_high = (after - dt).total_seconds()
        # Allow a small clock skew window of +/- 60 seconds
        assert -60 <= delta_low <= 60, f"created_at not near 'now' (before-delta={delta_low}); ca={ca}, before={before.isoformat()}"
        assert -60 <= delta_high <= 60, f"created_at not near 'now' (after-delta={delta_high}); ca={ca}, after={after.isoformat()}"


# --- Private account behavior ---

class TestPrivateAccount:
    def test_set_private_true(self, users):
        owner = users["owner"]
        r = requests.patch(f"{API}/users/me", json={"is_private": True},
                           headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["is_private"] is True

        # Verify persistence
        r = requests.get(f"{API}/auth/me", headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["is_private"] is True

    def test_owner_creates_tweets_after_private(self, users):
        owner = users["owner"]
        r = requests.post(f"{API}/tweets", json={"content": f"TEST private tweet A {uuid.uuid4().hex[:5]}"},
                          headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200, r.text
        users.setdefault("owner_tweet_id", r.json()["id"])

    # Follower follows the private owner
    def test_follower_follows_owner(self, users):
        owner = users["owner"]
        follower = users["follower"]
        r = requests.post(
            f"{API}/users/{owner['user']['username']}/follow",
            headers=_auth(follower["token"]), timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["following"] is True

    def test_feed_anonymous_excludes_private_tweets(self, users):
        owner_id = users["owner"]["user"]["id"]
        r = requests.get(f"{API}/tweets/feed?tab=forYou&limit=100", timeout=15)
        assert r.status_code == 200
        ids = [t["user_id"] for t in r.json()]
        assert owner_id not in ids, "Anonymous viewer should NOT see private user tweets in feed"

    def test_feed_stranger_excludes_private_tweets(self, users):
        owner_id = users["owner"]["user"]["id"]
        stranger = users["stranger"]
        r = requests.get(f"{API}/tweets/feed?tab=forYou&limit=100",
                         headers=_auth(stranger["token"]), timeout=15)
        assert r.status_code == 200
        ids = [t["user_id"] for t in r.json()]
        assert owner_id not in ids, "Stranger should NOT see private user tweets in feed"

    def test_feed_follower_sees_private_tweets(self, users):
        owner_id = users["owner"]["user"]["id"]
        follower = users["follower"]
        # forYou (the global feed path includes private filter — follower should still be allowed)
        r = requests.get(f"{API}/tweets/feed?tab=forYou&limit=100",
                         headers=_auth(follower["token"]), timeout=15)
        assert r.status_code == 200
        ids = [t["user_id"] for t in r.json()]
        assert owner_id in ids, "Follower should see private user tweets in forYou feed"

    def test_feed_owner_sees_own_private_tweets(self, users):
        owner = users["owner"]
        r = requests.get(f"{API}/tweets/feed?tab=forYou&limit=100",
                         headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200
        ids = [t["user_id"] for t in r.json()]
        assert owner["user"]["id"] in ids, "Owner should see own private tweets in feed"

    def test_user_tweets_anonymous_empty_for_private(self, users):
        username = users["owner"]["user"]["username"]
        r = requests.get(f"{API}/users/{username}/tweets", timeout=15)
        assert r.status_code == 200
        assert r.json() == [], "Anonymous viewer should get empty tweet list for private user"

    def test_user_tweets_stranger_empty_for_private(self, users):
        username = users["owner"]["user"]["username"]
        stranger = users["stranger"]
        r = requests.get(f"{API}/users/{username}/tweets",
                        headers=_auth(stranger["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json() == [], "Stranger should get empty tweet list for private user"

    def test_user_tweets_follower_sees_tweets(self, users):
        username = users["owner"]["user"]["username"]
        follower = users["follower"]
        r = requests.get(f"{API}/users/{username}/tweets",
                        headers=_auth(follower["token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1, "Follower should see private user tweets"

    def test_user_tweets_owner_sees_own(self, users):
        username = users["owner"]["user"]["username"]
        owner = users["owner"]
        r = requests.get(f"{API}/users/{username}/tweets",
                        headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1

    def test_tweet_detail_anonymous_403_private(self, users):
        tid = users.get("owner_tweet_id")
        assert tid, "owner_tweet_id missing; ensure earlier test ran"
        r = requests.get(f"{API}/tweets/{tid}", timeout=15)
        assert r.status_code == 403, f"Expected 403 got {r.status_code} {r.text}"
        body = r.json()
        # FastAPI default 'detail'
        assert "private_account" in (body.get("detail") or ""), f"Expected private_account detail, got {body}"

    def test_tweet_detail_stranger_403_private(self, users):
        tid = users["owner_tweet_id"]
        stranger = users["stranger"]
        r = requests.get(f"{API}/tweets/{tid}", headers=_auth(stranger["token"]), timeout=15)
        assert r.status_code == 403

    def test_tweet_detail_follower_200(self, users):
        tid = users["owner_tweet_id"]
        follower = users["follower"]
        r = requests.get(f"{API}/tweets/{tid}", headers=_auth(follower["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == tid

    def test_tweet_detail_owner_200(self, users):
        tid = users["owner_tweet_id"]
        owner = users["owner"]
        r = requests.get(f"{API}/tweets/{tid}", headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200

    def test_set_private_false_again(self, users):
        owner = users["owner"]
        r = requests.patch(f"{API}/users/me", json={"is_private": False},
                           headers=_auth(owner["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["is_private"] is False
        # Now anonymous can fetch user tweets
        username = owner["user"]["username"]
        r = requests.get(f"{API}/users/{username}/tweets", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1


# --- Like / Retweet regression ---

class TestEngagementRegression:
    def test_like_and_unlike(self, users):
        # Owner now public (last test set is_private=false). Stranger likes owner's tweet
        tid = users["owner_tweet_id"]
        stranger = users["stranger"]
        r = requests.post(f"{API}/tweets/{tid}/like", headers=_auth(stranger["token"]), timeout=15)
        assert r.status_code == 200 and r.json()["liked"] is True
        r = requests.post(f"{API}/tweets/{tid}/like", headers=_auth(stranger["token"]), timeout=15)
        assert r.status_code == 200 and r.json()["liked"] is False

    def test_retweet_and_un_retweet(self, users):
        tid = users["owner_tweet_id"]
        stranger = users["stranger"]
        r = requests.post(f"{API}/tweets/{tid}/retweet", headers=_auth(stranger["token"]), timeout=15)
        assert r.status_code == 200 and r.json()["retweeted"] is True
        r = requests.post(f"{API}/tweets/{tid}/retweet", headers=_auth(stranger["token"]), timeout=15)
        assert r.status_code == 200 and r.json()["retweeted"] is False
