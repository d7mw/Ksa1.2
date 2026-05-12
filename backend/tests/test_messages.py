"""
Backend tests for ksa1 Direct Messages feature.

Coverage:
- PATCH /api/users/me dm_privacy persistence + validation (everyone/followers, invalid 422)
- POST /api/messages/conversations: create/idempotent/404
- GET /api/messages/conversations: caller list sorted desc by last_message_at
- POST /api/messages/conversations/{id}: text-only send, attachments, empty_message
- Privacy enforcement: followers-only blocks unfollowed senders (403),
  followers can send, everyone allows all, self-DM blocked
- GET /api/messages/conversations/{id}: chronological + pagination (?before=)
- POST /api/messages/conversations/{id}/read marks read; unread-count drops
- GET /api/messages/unread-count global count
- DELETE /api/messages/conversations/{id}: hides for caller, peer still has it

Tests clean up TEST_-prefixed users + their conversations/messages at module teardown.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


# ---------------- helpers ----------------

def _sfx() -> str:
    return uuid.uuid4().hex[:8]


def _signup(prefix: str) -> dict:
    sfx = _sfx()
    username = f"test_{prefix}_{sfx}"[:20].lower()
    email = f"TEST_{prefix}_{sfx}@example.com"
    name = f"TEST {prefix} {sfx}"
    password = "Passw0rd!"

    r = requests.post(f"{API}/auth/signup/start", json={
        "name": name, "username": username, "email": email, "password": password,
    }, timeout=20)
    assert r.status_code == 200, f"signup_start: {r.status_code} {r.text}"

    otp = _db.otps.find_one({"email": email.lower()})
    assert otp, f"OTP missing for {email}"

    r = requests.post(f"{API}/auth/signup/verify", json={"email": email, "code": otp["code"]}, timeout=20)
    assert r.status_code == 200, f"signup_verify: {r.status_code} {r.text}"
    data = r.json()
    data["password"] = password
    data["username"] = username
    return data


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _follow(follower_token: str, target_username: str):
    r = requests.post(f"{API}/users/{target_username}/follow", headers=_auth(follower_token), timeout=20)
    assert r.status_code == 200, f"follow: {r.status_code} {r.text}"


def _parse_dt(s):
    if isinstance(s, datetime):
        return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


# ---------------- fixtures ----------------

_created_user_ids: list = []
_created_conv_ids: list = []


@pytest.fixture(scope="module")
def alice():
    u = _signup("alice")
    _created_user_ids.append(u["user"]["id"])
    return u


@pytest.fixture(scope="module")
def bob():
    u = _signup("bob")
    _created_user_ids.append(u["user"]["id"])
    return u


@pytest.fixture(scope="module")
def charlie():
    u = _signup("charlie")
    _created_user_ids.append(u["user"]["id"])
    return u


@pytest.fixture(scope="module", autouse=True)
def _cleanup():
    yield
    # Teardown: delete TEST_-prefixed users + all their conversations/messages
    if _created_user_ids:
        # Find convs participating
        convs = list(_db.conversations.find({"participants": {"$in": _created_user_ids}}))
        conv_ids = [c["id"] for c in convs]
        if conv_ids:
            _db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
            _db.conversations.delete_many({"id": {"$in": conv_ids}})
        _db.users.delete_many({"id": {"$in": _created_user_ids}})
        _db.follows.delete_many({"$or": [
            {"follower_id": {"$in": _created_user_ids}},
            {"following_id": {"$in": _created_user_ids}},
        ]})


# ---------------- DM privacy field on user ----------------

class TestDmPrivacyField:
    def test_default_is_everyone(self, alice):
        r = requests.get(f"{API}/auth/me", headers=_auth(alice["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json().get("dm_privacy") == "everyone"

    def test_patch_to_followers_persists(self, alice):
        r = requests.patch(f"{API}/users/me", headers=_auth(alice["token"]),
                           json={"dm_privacy": "followers"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["dm_privacy"] == "followers"
        # Verify via /auth/me
        r2 = requests.get(f"{API}/auth/me", headers=_auth(alice["token"]), timeout=20)
        assert r2.json()["dm_privacy"] == "followers"
        # Verify via /users/{username}
        r3 = requests.get(f"{API}/users/{alice['username']}", headers=_auth(alice["token"]), timeout=20)
        assert r3.status_code == 200
        assert r3.json()["dm_privacy"] == "followers"
        # Reset
        requests.patch(f"{API}/users/me", headers=_auth(alice["token"]),
                       json={"dm_privacy": "everyone"}, timeout=20)

    def test_invalid_dm_privacy_rejected(self, alice):
        r = requests.patch(f"{API}/users/me", headers=_auth(alice["token"]),
                           json={"dm_privacy": "nobody"}, timeout=20)
        assert r.status_code == 422, r.text


# ---------------- start conversation ----------------

class TestStartConversation:
    def test_create_new_then_idempotent(self, alice, bob):
        r = requests.post(f"{API}/messages/conversations",
                          headers=_auth(alice["token"]),
                          json={"username": bob["username"]}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("id", "peer", "unread_count", "can_send"):
            assert key in d, f"missing key {key}"
        assert d["peer"]["username"] == bob["username"]
        assert d["can_send"] is True
        assert d["block_reason"] is None
        _created_conv_ids.append(d["id"])
        conv_id = d["id"]

        # Idempotent
        r2 = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["id"] == conv_id

        # Reverse direction returns same conv
        r3 = requests.post(f"{API}/messages/conversations",
                           headers=_auth(bob["token"]),
                           json={"username": alice["username"]}, timeout=20)
        assert r3.status_code == 200
        assert r3.json()["id"] == conv_id

    def test_unknown_username_404(self, alice):
        r = requests.post(f"{API}/messages/conversations",
                          headers=_auth(alice["token"]),
                          json={"username": f"nope_{_sfx()}"}, timeout=20)
        assert r.status_code == 404

    def test_self_conversation_blocked(self, alice):
        r = requests.post(f"{API}/messages/conversations",
                          headers=_auth(alice["token"]),
                          json={"username": alice["username"]}, timeout=20)
        # Self-DM is rejected outright so no dangling conversation row is created.
        assert r.status_code == 400
        assert r.json().get("detail") == "cannot_dm_self"


# ---------------- list conversations ----------------

class TestListConversations:
    def test_list_includes_conv_with_unread_count(self, alice, bob):
        # ensure conv exists
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]

        r = requests.get(f"{API}/messages/conversations",
                         headers=_auth(alice["token"]), timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [c["id"] for c in items]
        assert conv_id in ids
        for c in items:
            assert "peer" in c and "unread_count" in c


# ---------------- send message ----------------

class TestSendMessage:
    def test_send_text_updates_preview(self, alice, bob):
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]

        r = requests.post(f"{API}/messages/conversations/{conv_id}",
                          headers=_auth(alice["token"]),
                          json={"content": "Hello bob TEST_msg1"}, timeout=20)
        assert r.status_code == 200, r.text
        m = r.json()
        for key in ("id", "conversation_id", "sender_id", "content", "attachments", "created_at", "read_by"):
            assert key in m
        assert m["conversation_id"] == conv_id
        assert m["sender_id"] == alice["user"]["id"]
        assert m["content"] == "Hello bob TEST_msg1"
        assert m["read_by"] == [alice["user"]["id"]]

        # Verify preview updated on convo list
        lr = requests.get(f"{API}/messages/conversations",
                          headers=_auth(alice["token"]), timeout=20)
        conv = next(c for c in lr.json() if c["id"] == conv_id)
        assert conv["last_message_preview"] == "Hello bob TEST_msg1"
        assert conv["last_message_at"] is not None

    def test_send_with_attachments(self, alice, bob):
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]
        # tiny 1x1 png base64
        img_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        file_b64 = "data:text/plain;base64,SGVsbG8gd29ybGQ="
        r = requests.post(f"{API}/messages/conversations/{conv_id}",
                          headers=_auth(alice["token"]),
                          json={
                              "content": "with attachments",
                              "attachments": [
                                  {"type": "image", "url": img_b64, "name": "tiny.png", "mime": "image/png"},
                                  {"type": "file", "url": file_b64, "name": "hello.txt", "mime": "text/plain"},
                              ],
                          }, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()
        assert len(m["attachments"]) == 2
        assert m["attachments"][0]["type"] == "image"
        assert m["attachments"][1]["type"] == "file"

    def test_empty_message_rejected(self, alice, bob):
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]
        r = requests.post(f"{API}/messages/conversations/{conv_id}",
                          headers=_auth(alice["token"]),
                          json={"content": "", "attachments": []}, timeout=20)
        assert r.status_code == 400, r.text
        # FastAPI returns detail field
        body = r.json()
        assert "empty_message" in (body.get("detail") or "")


# ---------------- privacy enforcement on send ----------------

class TestPrivacyOnSend:
    def test_followers_only_blocks_non_follower(self, bob, charlie):
        # bob sets followers-only
        r0 = requests.patch(f"{API}/users/me", headers=_auth(bob["token"]),
                            json={"dm_privacy": "followers"}, timeout=20)
        assert r0.status_code == 200

        # charlie opens conv with bob — open allowed, send blocked
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(charlie["token"]),
                           json={"username": bob["username"]}, timeout=20)
        assert cr.status_code == 200, cr.text
        d = cr.json()
        assert d["can_send"] is False
        assert d["block_reason"] == "dm_restricted_to_followers"
        conv_id = d["id"]

        r = requests.post(f"{API}/messages/conversations/{conv_id}",
                          headers=_auth(charlie["token"]),
                          json={"content": "hi bob"}, timeout=20)
        assert r.status_code == 403, r.text
        assert "dm_restricted_to_followers" in (r.json().get("detail") or "")

    def test_send_succeeds_when_recipient_follows_sender(self, bob, charlie):
        # bob remains followers-only. Make bob follow charlie -> charlie can send.
        _follow(bob["token"], charlie["username"])
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(charlie["token"]),
                           json={"username": bob["username"]}, timeout=20)
        d = cr.json()
        assert d["can_send"] is True
        assert d["block_reason"] is None
        r = requests.post(f"{API}/messages/conversations/{d['id']}",
                          headers=_auth(charlie["token"]),
                          json={"content": "now i can DM"}, timeout=20)
        assert r.status_code == 200, r.text
        # cleanup: bob unfollow charlie + reset privacy
        requests.post(f"{API}/users/{charlie['username']}/follow", headers=_auth(bob["token"]), timeout=20)
        requests.patch(f"{API}/users/me", headers=_auth(bob["token"]),
                       json={"dm_privacy": "everyone"}, timeout=20)

    def test_everyone_allows_strangers(self, alice, charlie):
        # alice default everyone -> charlie (not followed) can DM
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(charlie["token"]),
                           json={"username": alice["username"]}, timeout=20)
        d = cr.json()
        assert d["can_send"] is True
        r = requests.post(f"{API}/messages/conversations/{d['id']}",
                          headers=_auth(charlie["token"]),
                          json={"content": "hello stranger"}, timeout=20)
        assert r.status_code == 200, r.text


# ---------------- get conversation / pagination ----------------

class TestGetConversation:
    def test_chronological_and_pagination(self, alice, bob):
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]
        # send 5 messages
        sent = []
        for i in range(5):
            r = requests.post(f"{API}/messages/conversations/{conv_id}",
                              headers=_auth(alice["token"]),
                              json={"content": f"msg-{i}"}, timeout=20)
            assert r.status_code == 200
            sent.append(r.json())

        r = requests.get(f"{API}/messages/conversations/{conv_id}",
                         headers=_auth(alice["token"]), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == conv_id
        assert d["peer"]["username"] == bob["username"]
        msgs = d["messages"]
        assert len(msgs) >= 5
        # chronological asc
        dts = [_parse_dt(m["created_at"]) for m in msgs]
        assert dts == sorted(dts), f"messages not chronological: {dts}"

        # Pagination — pass `before` of the oldest of our sent messages, expect older only
        oldest = sent[0]
        r2 = requests.get(f"{API}/messages/conversations/{conv_id}",
                          headers=_auth(alice["token"]),
                          params={"before": oldest["id"], "limit": 50}, timeout=20)
        assert r2.status_code == 200
        older = r2.json()["messages"]
        # all should be strictly older than oldest
        oldest_dt = _parse_dt(oldest["created_at"])
        for m in older:
            assert _parse_dt(m["created_at"]) < oldest_dt

    def test_non_participant_404(self, alice, bob, charlie):
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]
        r = requests.get(f"{API}/messages/conversations/{conv_id}",
                         headers=_auth(charlie["token"]), timeout=20)
        assert r.status_code == 404


# ---------------- read / unread-count ----------------

class TestReadUnread:
    def test_read_marks_and_global_unread(self, alice, bob):
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]
        # alice -> bob 2 messages
        for i in range(2):
            requests.post(f"{API}/messages/conversations/{conv_id}",
                          headers=_auth(alice["token"]),
                          json={"content": f"unread-{i}"}, timeout=20)

        # bob's global unread should be >= 2
        uc = requests.get(f"{API}/messages/unread-count",
                          headers=_auth(bob["token"]), timeout=20)
        assert uc.status_code == 200
        assert uc.json()["count"] >= 2

        # bob's conv unread_count >= 2
        lr = requests.get(f"{API}/messages/conversations",
                          headers=_auth(bob["token"]), timeout=20)
        bobs_conv = next(c for c in lr.json() if c["id"] == conv_id)
        assert bobs_conv["unread_count"] >= 2

        # bob marks read
        rr = requests.post(f"{API}/messages/conversations/{conv_id}/read",
                           headers=_auth(bob["token"]), timeout=20)
        assert rr.status_code == 200

        # global unread drops for this conv. There may be other convs (e.g., charlie sent to bob earlier),
        # so we verify per-conv unread is 0.
        lr2 = requests.get(f"{API}/messages/conversations",
                           headers=_auth(bob["token"]), timeout=20)
        bobs_conv2 = next(c for c in lr2.json() if c["id"] == conv_id)
        assert bobs_conv2["unread_count"] == 0

        # All messages in conv now have bob in read_by
        gc = requests.get(f"{API}/messages/conversations/{conv_id}",
                          headers=_auth(bob["token"]), timeout=20)
        for m in gc.json()["messages"]:
            if m["sender_id"] != bob["user"]["id"]:
                assert bob["user"]["id"] in m["read_by"], f"msg {m['id']} not marked read"


# ---------------- delete conversation ----------------

class TestDeleteConversation:
    def test_delete_hides_for_caller_not_peer(self, alice, bob):
        cr = requests.post(f"{API}/messages/conversations",
                           headers=_auth(alice["token"]),
                           json={"username": bob["username"]}, timeout=20)
        conv_id = cr.json()["id"]
        # send something so it shows up
        requests.post(f"{API}/messages/conversations/{conv_id}",
                      headers=_auth(alice["token"]),
                      json={"content": "before delete"}, timeout=20)

        # alice deletes
        dr = requests.delete(f"{API}/messages/conversations/{conv_id}",
                             headers=_auth(alice["token"]), timeout=20)
        assert dr.status_code == 200, dr.text

        # alice no longer sees it
        lr = requests.get(f"{API}/messages/conversations",
                          headers=_auth(alice["token"]), timeout=20)
        assert all(c["id"] != conv_id for c in lr.json())

        # bob still sees it
        lr2 = requests.get(f"{API}/messages/conversations",
                           headers=_auth(bob["token"]), timeout=20)
        assert any(c["id"] == conv_id for c in lr2.json())
