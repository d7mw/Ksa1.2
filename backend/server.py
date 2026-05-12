from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import os
import logging
import random
import string
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from schemas import (
    SignupStart, SignupVerify, LoginRequest, GoogleAuth,
    UpdateProfile, TweetCreate, UsernameCheck, new_id,
    ForgotPasswordStart, ForgotPasswordVerify,
    ConversationStart, MessageCreate,
)
from auth_utils import (
    hash_password, verify_password, create_token, current_user,
    optional_user, require_admin, public_user, ADMIN_EMAIL,
)
from email_service import send_otp_email, send_password_reset_email, send_new_follower_email
import asyncio

# Mongo - tz_aware=True ensures all datetimes come back as UTC-aware so they
# serialize to ISO with timezone offset (preventing local-time misinterpretation).
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ['DB_NAME']]

app = FastAPI(title='ksa1 API')
api = APIRouter(prefix='/api')

logger = logging.getLogger('ksa1')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')

# ------------- helpers -------------

def now_utc():
    return datetime.now(timezone.utc)


def gen_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))


async def ensure_indexes():
    await db.users.create_index([('username', ASCENDING)], unique=True)
    await db.users.create_index([('email', ASCENDING)], unique=True)
    await db.tweets.create_index([('created_at', ASCENDING)])
    await db.tweets.create_index([('user_id', ASCENDING)])
    await db.follows.create_index([('follower_id', ASCENDING), ('following_id', ASCENDING)], unique=True)
    await db.likes.create_index([('user_id', ASCENDING), ('tweet_id', ASCENDING)], unique=True)
    await db.retweets.create_index([('user_id', ASCENDING), ('tweet_id', ASCENDING)], unique=True)
    await db.otps.create_index([('expires_at', ASCENDING)], expireAfterSeconds=0)
    await db.otps.create_index([('email', ASCENDING)])
    await db.password_resets.create_index([('expires_at', ASCENDING)], expireAfterSeconds=0)
    await db.password_resets.create_index([('email', ASCENDING)])
    # Direct messages
    await db.conversations.create_index([('participants', ASCENDING)])
    await db.conversations.create_index([('last_message_at', ASCENDING)])
    await db.messages.create_index([('conversation_id', ASCENDING), ('created_at', ASCENDING)])


async def can_view_user_posts(target_user: dict, viewer_id: Optional[str]) -> bool:
    """Returns True if viewer can see target_user's posts.
    Public accounts: always visible.
    Private accounts: visible only to the user themselves, the admin, or approved followers.
    """
    if not target_user:
        return False
    if not target_user.get('is_private'):
        return True
    if not viewer_id:
        return False
    if viewer_id == target_user['id']:
        return True
    # Admin override
    viewer = await db.users.find_one({'id': viewer_id})
    if viewer and viewer.get('email', '').lower() == ADMIN_EMAIL:
        return True
    # Follower check
    follow_doc = await db.follows.find_one({'follower_id': viewer_id, 'following_id': target_user['id']})
    return bool(follow_doc)


async def serialize_tweet(tw: dict, viewer_id: Optional[str]) -> dict:
    author = await db.users.find_one({'id': tw['user_id']})
    liked = False
    retweeted = False
    if viewer_id:
        liked = bool(await db.likes.find_one({'user_id': viewer_id, 'tweet_id': tw['id']}))
        retweeted = bool(await db.retweets.find_one({'user_id': viewer_id, 'tweet_id': tw['id']}))
    return {
        'id': tw['id'],
        'user_id': tw['user_id'],
        'content': tw['content'],
        'image': tw.get('image'),
        'parent_id': tw.get('parent_id'),
        'created_at': tw['created_at'],
        'likes_count': tw.get('likes_count', 0),
        'retweets_count': tw.get('retweets_count', 0),
        'replies_count': tw.get('replies_count', 0),
        'views': tw.get('views', 0),
        'liked': liked,
        'retweeted': retweeted,
        'author': public_user(author, viewer_id) if author else None,
    }


def _format_tweet(tw: dict, author: Optional[dict], viewer_id: Optional[str], liked: bool, retweeted: bool) -> dict:
    return {
        'id': tw['id'],
        'user_id': tw['user_id'],
        'content': tw['content'],
        'image': tw.get('image'),
        'parent_id': tw.get('parent_id'),
        'created_at': tw['created_at'],
        'likes_count': tw.get('likes_count', 0),
        'retweets_count': tw.get('retweets_count', 0),
        'replies_count': tw.get('replies_count', 0),
        'views': tw.get('views', 0),
        'liked': liked,
        'retweeted': retweeted,
        'author': public_user(author, viewer_id) if author else None,
    }


async def serialize_tweets(tweets_list: list, viewer_id: Optional[str]) -> list:
    """Batched version of serialize_tweet to avoid N+1 queries."""
    if not tweets_list:
        return []
    user_ids = list({t['user_id'] for t in tweets_list})
    tweet_ids = [t['id'] for t in tweets_list]

    authors_cur = db.users.find({'id': {'$in': user_ids}})
    authors_list = await authors_cur.to_list(len(user_ids))
    authors_by_id = {u['id']: u for u in authors_list}

    liked_ids = set()
    retweeted_ids = set()
    if viewer_id:
        likes_cur = db.likes.find({'user_id': viewer_id, 'tweet_id': {'$in': tweet_ids}})
        likes_docs = await likes_cur.to_list(len(tweet_ids))
        liked_ids = {l['tweet_id'] for l in likes_docs}

        rt_cur = db.retweets.find({'user_id': viewer_id, 'tweet_id': {'$in': tweet_ids}})
        rt_docs = await rt_cur.to_list(len(tweet_ids))
        retweeted_ids = {r['tweet_id'] for r in rt_docs}

    return [
        _format_tweet(t, authors_by_id.get(t['user_id']), viewer_id, t['id'] in liked_ids, t['id'] in retweeted_ids)
        for t in tweets_list
    ]


# ------------- auth -------------

@api.post('/auth/signup/start')
async def signup_start(payload: SignupStart):
    email = payload.email.lower()
    username = payload.username  # already normalized

    if await db.users.find_one({'email': email}):
        raise HTTPException(409, 'email_taken')
    if await db.users.find_one({'username': username}):
        raise HTTPException(409, 'username_taken')

    code = gen_otp()
    expires = now_utc() + timedelta(minutes=10)

    # Replace any existing pending otp for this email
    await db.otps.delete_many({'email': email})
    await db.otps.insert_one({
        'id': new_id(),
        'email': email,
        'code': code,
        'expires_at': expires,
        'attempts': 0,
        'pending_user': {
            'name': payload.name.strip(),
            'username': username,
            'email': email,
            'password_hash': hash_password(payload.password),
        },
        'created_at': now_utc(),
    })

    ok, msg = send_otp_email(email, code, 'ar')
    return {'status': 'otp_sent', 'email': email, 'delivery': 'ok' if ok else f'failed: {msg}'}


@api.post('/auth/signup/verify')
async def signup_verify(payload: SignupVerify):
    email = payload.email.lower()
    otp = await db.otps.find_one({'email': email})
    if not otp:
        raise HTTPException(400, 'otp_not_found')
    if otp.get('attempts', 0) >= 5:
        await db.otps.delete_one({'_id': otp['_id']})
        raise HTTPException(429, 'too_many_attempts')
    if otp['code'] != payload.code:
        await db.otps.update_one({'_id': otp['_id']}, {'$inc': {'attempts': 1}})
        raise HTTPException(400, 'invalid_code')

    pending = otp['pending_user']

    # Double-check uniqueness at commit time
    if await db.users.find_one({'email': pending['email']}):
        await db.otps.delete_one({'_id': otp['_id']})
        raise HTTPException(409, 'email_taken')
    if await db.users.find_one({'username': pending['username']}):
        await db.otps.delete_one({'_id': otp['_id']})
        raise HTTPException(409, 'username_taken')

    user_id = new_id()
    user = {
        'id': user_id,
        'name': pending['name'],
        'username': pending['username'],
        'email': pending['email'],
        'password_hash': pending['password_hash'],
        'auth_provider': 'email',
        'verified': False,
        'verification_requested': False,
        'banned': False,
        'bio': '',
        'location': '',
        'avatar': '',
        'cover': '',
        'followers_count': 0,
        'following_count': 0,
        'created_at': now_utc(),
        'email_verified': True,
    }
    await db.users.insert_one(user)
    await db.otps.delete_one({'_id': otp['_id']})

    token = create_token(user_id)
    return {'token': token, 'user': public_user(user, user_id)}


@api.post('/auth/login')
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({'email': email})
    if not user:
        raise HTTPException(401, 'invalid_credentials')
    if user.get('banned'):
        raise HTTPException(403, 'account_banned')
    if user.get('auth_provider') == 'google' and not user.get('password_hash'):
        raise HTTPException(401, 'use_google_login')
    if not verify_password(payload.password, user.get('password_hash', '')):
        raise HTTPException(401, 'invalid_credentials')
    if not user.get('email_verified'):
        raise HTTPException(403, 'email_not_verified')

    token = create_token(user['id'])
    return {'token': token, 'user': public_user(user, user['id'])}


@api.post('/auth/google')
async def google_auth(payload: GoogleAuth):
    """Login or register a user via Google. Trusted client-side Emergent Auth integration."""
    email = payload.email.lower().strip()
    user = await db.users.find_one({'email': email})

    if not user:
        # Generate unique username from email
        from schemas import RESERVED_USERNAMES
        base = email.split('@')[0]
        base = ''.join(c for c in base if c.isalnum() or c == '_').lower()[:20] or 'user'
        if base in RESERVED_USERNAMES or len(base) < 3:
            base = f'user{int(now_utc().timestamp())}'[:20]
        username = base
        i = 0
        while await db.users.find_one({'username': username}) or username in RESERVED_USERNAMES:
            i += 1
            username = f'{base}{i}'[:20]

        user_id = new_id()
        user = {
            'id': user_id,
            'name': payload.name[:50],
            'username': username,
            'email': email,
            'password_hash': '',
            'auth_provider': 'google',
            'verified': False,
            'verification_requested': False,
            'banned': False,
            'bio': '',
            'location': '',
            'avatar': payload.avatar or '',
            'cover': '',
            'followers_count': 0,
            'following_count': 0,
            'created_at': now_utc(),
            'email_verified': True,
        }
        await db.users.insert_one(user)
    else:
        if user.get('banned'):
            raise HTTPException(403, 'account_banned')

    token = create_token(user['id'])
    return {'token': token, 'user': public_user(user, user['id'])}


@api.get('/auth/me')
async def get_me(user=Depends(current_user)):
    return public_user(user, user['id'])


@api.post('/auth/check-username')
async def check_username(payload: UsernameCheck, user=Depends(optional_user)):
    from schemas import USERNAME_RE, RESERVED_USERNAMES
    uname = payload.username.strip().lstrip('@').lower()
    if not USERNAME_RE.match(uname):
        return {'available': False, 'reason': 'invalid_format'}
    if uname in RESERVED_USERNAMES:
        return {'available': False, 'reason': 'reserved'}
    existing = await db.users.find_one({'username': uname})
    if existing and (not user or existing['id'] != user['id']):
        return {'available': False, 'reason': 'taken'}
    return {'available': True}


@api.post('/auth/forgot-password/start')
async def forgot_password_start(payload: ForgotPasswordStart):
    email = payload.email.lower().strip()
    user = await db.users.find_one({'email': email})
    # Always return ok to avoid email enumeration; only send code if user exists
    if user and user.get('auth_provider') != 'google':
        code = gen_otp()
        expires = now_utc() + timedelta(minutes=10)
        await db.password_resets.delete_many({'email': email})
        await db.password_resets.insert_one({
            'id': new_id(),
            'email': email,
            'code': code,
            'expires_at': expires,
            'attempts': 0,
            'created_at': now_utc(),
        })
        send_password_reset_email(email, code, 'ar')
    return {'status': 'ok'}


@api.post('/auth/forgot-password/verify')
async def forgot_password_verify(payload: ForgotPasswordVerify):
    email = payload.email.lower().strip()
    rec = await db.password_resets.find_one({'email': email})
    if not rec:
        raise HTTPException(400, 'otp_not_found')
    if rec.get('attempts', 0) >= 5:
        await db.password_resets.delete_one({'_id': rec['_id']})
        raise HTTPException(429, 'too_many_attempts')
    if rec['code'] != payload.code:
        await db.password_resets.update_one({'_id': rec['_id']}, {'$inc': {'attempts': 1}})
        raise HTTPException(400, 'invalid_code')
    # Check expiry manually (TTL also handles it)
    if rec['expires_at'].replace(tzinfo=timezone.utc) < now_utc():
        await db.password_resets.delete_one({'_id': rec['_id']})
        raise HTTPException(400, 'otp_expired')

    user = await db.users.find_one({'email': email})
    if not user:
        raise HTTPException(404, 'user_not_found')
    await db.users.update_one({'id': user['id']}, {'$set': {
        'password_hash': hash_password(payload.new_password),
    }})
    await db.password_resets.delete_one({'_id': rec['_id']})
    token = create_token(user['id'])
    user = await db.users.find_one({'id': user['id']})
    return {'token': token, 'user': public_user(user, user['id'])}


# ------------- users -------------

@api.patch('/users/me')
async def update_me(payload: UpdateProfile, user=Depends(current_user)):
    updates = {}
    if payload.name is not None:
        updates['name'] = payload.name.strip()[:50]
    if payload.username is not None and payload.username != user['username']:
        existing = await db.users.find_one({'username': payload.username})
        if existing and existing['id'] != user['id']:
            raise HTTPException(409, 'username_taken')
        updates['username'] = payload.username
    if payload.bio is not None:
        updates['bio'] = payload.bio[:160]
    if payload.location is not None:
        updates['location'] = payload.location[:30]
    if payload.avatar is not None:
        updates['avatar'] = payload.avatar
    if payload.cover is not None:
        updates['cover'] = payload.cover
    if payload.is_private is not None:
        updates['is_private'] = bool(payload.is_private)
    if payload.email_notifications_disabled is not None:
        updates['email_notifications_disabled'] = bool(payload.email_notifications_disabled)
    if payload.dm_privacy is not None:
        updates['dm_privacy'] = payload.dm_privacy

    if updates:
        await db.users.update_one({'id': user['id']}, {'$set': updates})
    updated = await db.users.find_one({'id': user['id']})
    return public_user(updated, user['id'])


@api.get('/users/{username}')
async def get_user(username: str, viewer=Depends(optional_user)):
    u = await db.users.find_one({'username': username.lower()})
    if not u:
        raise HTTPException(404, 'user_not_found')
    viewer_id = viewer['id'] if viewer else None
    data = public_user(u, viewer_id)
    if viewer_id and viewer_id != u['id']:
        data['is_following'] = bool(await db.follows.find_one({'follower_id': viewer_id, 'following_id': u['id']}))
    return data


@api.post('/users/{username}/follow')
async def follow_user(username: str, user=Depends(current_user)):
    target = await db.users.find_one({'username': username.lower()})
    if not target:
        raise HTTPException(404, 'user_not_found')
    if target['id'] == user['id']:
        raise HTTPException(400, 'cannot_follow_self')

    existing = await db.follows.find_one({'follower_id': user['id'], 'following_id': target['id']})
    if existing:
        await db.follows.delete_one({'_id': existing['_id']})
        await db.users.update_one({'id': user['id']}, {'$inc': {'following_count': -1}})
        await db.users.update_one({'id': target['id']}, {'$inc': {'followers_count': -1}})
        target = await db.users.find_one({'id': target['id']})
        return {
            'following': False,
            'target_followers_count': target.get('followers_count', 0),
        }
    else:
        await db.follows.insert_one({
            'id': new_id(),
            'follower_id': user['id'],
            'following_id': target['id'],
            'created_at': now_utc(),
        })
        await db.users.update_one({'id': user['id']}, {'$inc': {'following_count': 1}})
        await db.users.update_one({'id': target['id']}, {'$inc': {'followers_count': 1}})
        await db.notifications.insert_one({
            'id': new_id(),
            'type': 'follow',
            'recipient_id': target['id'],
            'actor_id': user['id'],
            'created_at': now_utc(),
            'read': False,
        })
        # Send follower email notification (fire-and-forget so it doesn't block)
        target_email = target.get('email')
        if target_email and not target.get('email_notifications_disabled'):
            asyncio.create_task(
                asyncio.to_thread(
                    send_new_follower_email,
                    target_email,
                    target.get('name', ''),
                    user.get('name', ''),
                    user.get('username', ''),
                    'ar',
                )
            )
        target = await db.users.find_one({'id': target['id']})
        return {
            'following': True,
            'target_followers_count': target.get('followers_count', 0),
        }


@api.get('/users/{username}/followers')
async def list_followers(username: str, viewer=Depends(optional_user)):
    u = await db.users.find_one({'username': username.lower()})
    if not u:
        raise HTTPException(404, 'user_not_found')
    follows = await db.follows.find({'following_id': u['id']}).sort([('created_at', -1)]).limit(500).to_list(500)
    if not follows:
        return []
    ids = [f['follower_id'] for f in follows]
    users_list = await db.users.find({'id': {'$in': ids}, 'banned': {'$ne': True}}).to_list(len(ids))
    by_id = {u['id']: u for u in users_list}

    viewer_id = viewer['id'] if viewer else None
    viewer_follows = set()
    if viewer_id:
        v_follows = await db.follows.find({'follower_id': viewer_id, 'following_id': {'$in': ids}}).to_list(len(ids))
        viewer_follows = {f['following_id'] for f in v_follows}

    out = []
    for f in follows:
        usr = by_id.get(f['follower_id'])
        if not usr:
            continue
        data = public_user(usr, viewer_id)
        data['is_following'] = usr['id'] in viewer_follows
        data['is_self'] = viewer_id == usr['id']
        out.append(data)
    return out


@api.get('/users/{username}/following')
async def list_following(username: str, viewer=Depends(optional_user)):
    u = await db.users.find_one({'username': username.lower()})
    if not u:
        raise HTTPException(404, 'user_not_found')
    follows = await db.follows.find({'follower_id': u['id']}).sort([('created_at', -1)]).limit(500).to_list(500)
    if not follows:
        return []
    ids = [f['following_id'] for f in follows]
    users_list = await db.users.find({'id': {'$in': ids}, 'banned': {'$ne': True}}).to_list(len(ids))
    by_id = {u['id']: u for u in users_list}

    viewer_id = viewer['id'] if viewer else None
    viewer_follows = set()
    if viewer_id:
        v_follows = await db.follows.find({'follower_id': viewer_id, 'following_id': {'$in': ids}}).to_list(len(ids))
        viewer_follows = {f['following_id'] for f in v_follows}

    out = []
    for f in follows:
        usr = by_id.get(f['following_id'])
        if not usr:
            continue
        data = public_user(usr, viewer_id)
        data['is_following'] = usr['id'] in viewer_follows
        data['is_self'] = viewer_id == usr['id']
        out.append(data)
    return out


# ------------- verification request -------------

@api.post('/users/me/request-verification')
async def request_verification(plan: str = Query('monthly', regex='^(monthly|yearly)$'), user=Depends(current_user)):
    if user.get('verified'):
        raise HTTPException(400, 'already_verified')
    if user.get('verification_requested'):
        raise HTTPException(400, 'already_requested')

    await db.users.update_one({'id': user['id']}, {'$set': {
        'verification_requested': True,
        'verification_plan': plan,
        'verification_requested_at': now_utc(),
    }})
    await db.verification_requests.insert_one({
        'id': new_id(),
        'user_id': user['id'],
        'plan': plan,
        'price': 25 if plan == 'monthly' else 200,
        'status': 'pending',
        'created_at': now_utc(),
    })
    return {'status': 'pending', 'plan': plan}


# ------------- tweets -------------

@api.post('/tweets')
async def create_tweet(payload: TweetCreate, user=Depends(current_user)):
    if payload.image and len(payload.image) > 7_500_000:
        raise HTTPException(413, 'image_too_large')
    if payload.parent_id:
        parent = await db.tweets.find_one({'id': payload.parent_id})
        if not parent:
            raise HTTPException(404, 'parent_not_found')

    tw = {
        'id': new_id(),
        'user_id': user['id'],
        'content': payload.content.strip(),
        'image': payload.image,
        'parent_id': payload.parent_id,
        'likes_count': 0,
        'retweets_count': 0,
        'replies_count': 0,
        'views': 0,
        'created_at': now_utc(),
    }
    await db.tweets.insert_one(tw)

    if payload.parent_id:
        await db.tweets.update_one({'id': payload.parent_id}, {'$inc': {'replies_count': 1}})
        parent = await db.tweets.find_one({'id': payload.parent_id})
        if parent and parent['user_id'] != user['id']:
            await db.notifications.insert_one({
                'id': new_id(),
                'type': 'reply',
                'recipient_id': parent['user_id'],
                'actor_id': user['id'],
                'tweet_id': tw['id'],
                'parent_tweet_id': payload.parent_id,
                'preview': payload.content[:80],
                'created_at': now_utc(),
                'read': False,
            })

    return await serialize_tweet(tw, user['id'])


@api.get('/tweets/feed')
async def feed(tab: str = 'forYou', limit: int = 50, user=Depends(optional_user)):
    viewer_id = user['id'] if user else None
    q = {'parent_id': None}
    if tab == 'following' and user:
        follows = await db.follows.find({'follower_id': user['id']}).to_list(1000)
        following_ids = [f['following_id'] for f in follows] + [user['id']]
        q['user_id'] = {'$in': following_ids}
    elif tab == 'trending':
        cursor = db.tweets.find({'parent_id': None}).sort([('likes_count', -1)]).limit(limit * 2)
        items = await cursor.to_list(limit * 2)
        items = await _filter_private_tweets(items, viewer_id)
        return await serialize_tweets(items[:limit], viewer_id)

    cursor = db.tweets.find(q).sort([('created_at', -1)]).limit(limit * 2)
    items = await cursor.to_list(limit * 2)
    if tab != 'following':
        items = await _filter_private_tweets(items, viewer_id)
    return await serialize_tweets(items[:limit], viewer_id)


async def _filter_private_tweets(items: list, viewer_id: Optional[str]) -> list:
    """Remove tweets from private accounts the viewer can't see."""
    if not items:
        return items
    author_ids = list({t['user_id'] for t in items})
    private_authors = await db.users.find({'id': {'$in': author_ids}, 'is_private': True}).to_list(len(author_ids))
    if not private_authors:
        return items
    private_ids = {u['id'] for u in private_authors}
    accessible_private = set()
    if viewer_id:
        accessible_private.add(viewer_id)
        follows = await db.follows.find({'follower_id': viewer_id, 'following_id': {'$in': list(private_ids)}}).to_list(len(private_ids))
        accessible_private.update(f['following_id'] for f in follows)
        viewer = await db.users.find_one({'id': viewer_id})
        if viewer and viewer.get('email', '').lower() == ADMIN_EMAIL:
            accessible_private.update(private_ids)
    return [t for t in items if t['user_id'] not in private_ids or t['user_id'] in accessible_private]


@api.get('/tweets/{tweet_id}')
async def get_tweet(tweet_id: str, user=Depends(optional_user)):
    tw = await db.tweets.find_one({'id': tweet_id})
    if not tw:
        raise HTTPException(404, 'tweet_not_found')
    author = await db.users.find_one({'id': tw['user_id']})
    viewer_id = user['id'] if user else None
    if author and not await can_view_user_posts(author, viewer_id):
        raise HTTPException(403, 'private_account')
    await db.tweets.update_one({'id': tweet_id}, {'$inc': {'views': 1}})
    tw['views'] = tw.get('views', 0) + 1
    return await serialize_tweet(tw, viewer_id)


@api.get('/tweets/{tweet_id}/replies')
async def get_replies(tweet_id: str, user=Depends(optional_user)):
    viewer_id = user['id'] if user else None
    cursor = db.tweets.find({'parent_id': tweet_id}).sort([('created_at', -1)])
    items = await cursor.to_list(200)
    return await serialize_tweets(items, viewer_id)


@api.delete('/tweets/{tweet_id}')
async def delete_tweet(tweet_id: str, user=Depends(current_user)):
    tw = await db.tweets.find_one({'id': tweet_id})
    if not tw:
        raise HTTPException(404, 'tweet_not_found')
    if tw['user_id'] != user['id'] and not user.get('is_admin'):
        raise HTTPException(403, 'forbidden')
    await db.tweets.delete_one({'id': tweet_id})
    await db.tweets.delete_many({'parent_id': tweet_id})
    await db.likes.delete_many({'tweet_id': tweet_id})
    await db.retweets.delete_many({'tweet_id': tweet_id})
    if tw.get('parent_id'):
        await db.tweets.update_one({'id': tw['parent_id']}, {'$inc': {'replies_count': -1}})
    return {'deleted': True}


@api.post('/tweets/{tweet_id}/like')
async def like_tweet(tweet_id: str, user=Depends(current_user)):
    tw = await db.tweets.find_one({'id': tweet_id})
    if not tw:
        raise HTTPException(404, 'tweet_not_found')
    existing = await db.likes.find_one({'user_id': user['id'], 'tweet_id': tweet_id})
    if existing:
        await db.likes.delete_one({'_id': existing['_id']})
        await db.tweets.update_one({'id': tweet_id}, {'$inc': {'likes_count': -1}})
        return {'liked': False}
    await db.likes.insert_one({
        'id': new_id(),
        'user_id': user['id'],
        'tweet_id': tweet_id,
        'created_at': now_utc(),
    })
    await db.tweets.update_one({'id': tweet_id}, {'$inc': {'likes_count': 1}})
    if tw['user_id'] != user['id']:
        await db.notifications.insert_one({
            'id': new_id(),
            'type': 'like',
            'recipient_id': tw['user_id'],
            'actor_id': user['id'],
            'tweet_id': tweet_id,
            'created_at': now_utc(),
            'read': False,
        })
    return {'liked': True}


@api.post('/tweets/{tweet_id}/retweet')
async def retweet_tweet(tweet_id: str, user=Depends(current_user)):
    tw = await db.tweets.find_one({'id': tweet_id})
    if not tw:
        raise HTTPException(404, 'tweet_not_found')
    existing = await db.retweets.find_one({'user_id': user['id'], 'tweet_id': tweet_id})
    if existing:
        await db.retweets.delete_one({'_id': existing['_id']})
        await db.tweets.update_one({'id': tweet_id}, {'$inc': {'retweets_count': -1}})
        return {'retweeted': False}
    await db.retweets.insert_one({
        'id': new_id(),
        'user_id': user['id'],
        'tweet_id': tweet_id,
        'created_at': now_utc(),
    })
    await db.tweets.update_one({'id': tweet_id}, {'$inc': {'retweets_count': 1}})
    if tw['user_id'] != user['id']:
        await db.notifications.insert_one({
            'id': new_id(),
            'type': 'retweet',
            'recipient_id': tw['user_id'],
            'actor_id': user['id'],
            'tweet_id': tweet_id,
            'created_at': now_utc(),
            'read': False,
        })
    return {'retweeted': True}


@api.get('/users/{username}/tweets')
async def user_tweets(username: str, kind: str = 'posts', user=Depends(optional_user)):
    u = await db.users.find_one({'username': username.lower()})
    if not u:
        raise HTTPException(404, 'user_not_found')
    viewer_id = user['id'] if user else None

    # Private-account gate: only owner / admin / followers can see posts
    if not await can_view_user_posts(u, viewer_id):
        # Return empty list; frontend detects privacy via user.is_private on the profile response.
        return []
    return await _user_tweets_payload(u, kind, viewer_id)


async def _user_tweets_payload(u: dict, kind: str, viewer_id: Optional[str]):
    if kind == 'media':
        cursor = db.tweets.find({'user_id': u['id'], 'image': {'$ne': None}}).sort([('created_at', -1)])
        items = await cursor.to_list(200)
        return await serialize_tweets(items, viewer_id)

    if kind == 'replies':
        cursor = db.tweets.find({'user_id': u['id'], 'parent_id': {'$ne': None}}).sort([('created_at', -1)])
        items = await cursor.to_list(200)
        return await serialize_tweets(items, viewer_id)

    if kind == 'likes':
        likes = await db.likes.find({'user_id': u['id']}).sort([('created_at', -1)]).to_list(200)
        ids = [l['tweet_id'] for l in likes]
        cursor = db.tweets.find({'id': {'$in': ids}})
        items = await cursor.to_list(200)
        order = {tid: i for i, tid in enumerate(ids)}
        items.sort(key=lambda t: order.get(t['id'], 999999))
        return await serialize_tweets(items, viewer_id)

    # kind == 'posts': own tweets + retweets, merged chronologically
    own_cursor = db.tweets.find({'user_id': u['id'], 'parent_id': None}).sort([('created_at', -1)]).limit(200)
    own_items = await own_cursor.to_list(200)

    rt_docs = await db.retweets.find({'user_id': u['id']}).sort([('created_at', -1)]).limit(200).to_list(200)
    rt_tweet_ids = [r['tweet_id'] for r in rt_docs]
    rt_tweets_by_id = {}
    if rt_tweet_ids:
        rt_list = await db.tweets.find({'id': {'$in': rt_tweet_ids}}).to_list(len(rt_tweet_ids))
        rt_tweets_by_id = {t['id']: t for t in rt_list}

    combined = []
    for t in own_items:
        combined.append((t['created_at'], t, None))
    for r in rt_docs:
        t = rt_tweets_by_id.get(r['tweet_id'])
        if t:
            combined.append((r['created_at'], t, u))
    combined.sort(key=lambda x: x[0], reverse=True)
    combined = combined[:200]

    tweets_list = [c[1] for c in combined]
    serialized = await serialize_tweets(tweets_list, viewer_id)

    out = []
    for (sort_time, _t, retweeter), s in zip(combined, serialized):
        if retweeter:
            out.append({**s, 'retweeted_by': public_user(retweeter, viewer_id), 'retweeted_at': sort_time})
        else:
            out.append(s)
    return out


# ------------- notifications -------------

@api.get('/notifications')
async def get_notifications(user=Depends(current_user)):
    items = await db.notifications.find({'recipient_id': user['id']}).sort([('created_at', -1)]).limit(50).to_list(50)
    if not items:
        return []
    actor_ids = list({n['actor_id'] for n in items if n.get('actor_id')})
    actors_list = await db.users.find({'id': {'$in': actor_ids}}).to_list(len(actor_ids)) if actor_ids else []
    actors_by_id = {u['id']: u for u in actors_list}
    out = []
    for n in items:
        actor = actors_by_id.get(n.get('actor_id'))
        out.append({
            'id': n['id'],
            'type': n['type'],
            'created_at': n['created_at'],
            'read': n.get('read', False),
            'tweet_id': n.get('tweet_id'),
            'preview': n.get('preview'),
            'actor': public_user(actor, user['id']) if actor else None,
        })
    await db.notifications.update_many({'recipient_id': user['id'], 'read': False}, {'$set': {'read': True}})
    return out


@api.get('/notifications/unread-count')
async def unread_count(user=Depends(current_user)):
    n = await db.notifications.count_documents({'recipient_id': user['id'], 'read': False})
    return {'count': n}


# ------------- explore / suggestions -------------

@api.get('/users/suggestions/list')
async def suggestions(user=Depends(current_user)):
    follows = await db.follows.find({'follower_id': user['id']}).to_list(1000)
    excluded = [f['following_id'] for f in follows] + [user['id']]
    cursor = db.users.find({'id': {'$nin': excluded}, 'banned': {'$ne': True}}).sort([('followers_count', -1)]).limit(5)
    items = await cursor.to_list(5)
    return [public_user(u, user['id']) for u in items]


@api.get('/search/tweets')
async def search_tweets(q: str = Query(..., min_length=1), user=Depends(optional_user)):
    viewer_id = user['id'] if user else None
    cursor = db.tweets.find({'content': {'$regex': q, '$options': 'i'}, 'parent_id': None}).sort([('created_at', -1)]).limit(50)
    items = await cursor.to_list(50)
    return await serialize_tweets(items, viewer_id)


@api.get('/search/users')
async def search_users(q: str = Query(..., min_length=1), user=Depends(optional_user)):
    cursor = db.users.find({
        '$or': [
            {'username': {'$regex': q.lower(), '$options': 'i'}},
            {'name': {'$regex': q, '$options': 'i'}},
        ],
        'banned': {'$ne': True},
    }).limit(20)
    items = await cursor.to_list(20)
    viewer_id = user['id'] if user else None
    return [public_user(u, viewer_id) for u in items]


# ------------- admin -------------

@api.get('/admin/stats')
async def admin_stats(_=Depends(require_admin)):
    return {
        'users': await db.users.count_documents({}),
        'tweets': await db.tweets.count_documents({}),
        'verified': await db.users.count_documents({'verified': True}),
        'pending_verifications': await db.verification_requests.count_documents({'status': 'pending'}),
        'banned': await db.users.count_documents({'banned': True}),
    }


@api.get('/admin/users')
async def admin_users(q: str = '', skip: int = 0, limit: int = 50, _=Depends(require_admin)):
    query = {}
    if q:
        query = {
            '$or': [
                {'username': {'$regex': q.lower(), '$options': 'i'}},
                {'email': {'$regex': q.lower(), '$options': 'i'}},
                {'name': {'$regex': q, '$options': 'i'}},
            ]
        }
    cursor = db.users.find(query).sort([('created_at', -1)]).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    return [{
        **public_user(u, u['id']),
        'email': u.get('email'),
        'banned': u.get('banned', False),
        'auth_provider': u.get('auth_provider'),
    } for u in items]


@api.post('/admin/users/{user_id}/verify')
async def admin_verify(user_id: str, _=Depends(require_admin)):
    await db.users.update_one({'id': user_id}, {'$set': {
        'verified': True,
        'verification_requested': False,
        'verified_at': now_utc(),
    }})
    await db.verification_requests.update_many(
        {'user_id': user_id, 'status': 'pending'},
        {'$set': {'status': 'approved', 'reviewed_at': now_utc()}}
    )
    await db.notifications.insert_one({
        'id': new_id(),
        'type': 'verified',
        'recipient_id': user_id,
        'actor_id': user_id,
        'created_at': now_utc(),
        'read': False,
    })
    return {'verified': True}


@api.post('/admin/users/{user_id}/unverify')
async def admin_unverify(user_id: str, _=Depends(require_admin)):
    await db.users.update_one({'id': user_id}, {'$set': {'verified': False}})
    return {'verified': False}


@api.post('/admin/users/{user_id}/ban')
async def admin_ban(user_id: str, _=Depends(require_admin)):
    await db.users.update_one({'id': user_id}, {'$set': {'banned': True}})
    return {'banned': True}


@api.post('/admin/users/{user_id}/unban')
async def admin_unban(user_id: str, _=Depends(require_admin)):
    await db.users.update_one({'id': user_id}, {'$set': {'banned': False}})
    return {'banned': False}


@api.delete('/admin/users/{user_id}')
async def admin_delete_user(user_id: str, _=Depends(require_admin)):
    await db.users.delete_one({'id': user_id})
    await db.tweets.delete_many({'user_id': user_id})
    await db.likes.delete_many({'user_id': user_id})
    await db.retweets.delete_many({'user_id': user_id})
    await db.follows.delete_many({'$or': [{'follower_id': user_id}, {'following_id': user_id}]})
    await db.notifications.delete_many({'$or': [{'recipient_id': user_id}, {'actor_id': user_id}]})
    return {'deleted': True}


@api.get('/admin/verification-requests')
async def admin_verification_requests(status: str = 'pending', _=Depends(require_admin)):
    cursor = db.verification_requests.find({'status': status}).sort([('created_at', -1)]).limit(100)
    items = await cursor.to_list(100)
    if not items:
        return []
    user_ids = list({r['user_id'] for r in items})
    users_list = await db.users.find({'id': {'$in': user_ids}}).to_list(len(user_ids))
    users_by_id = {u['id']: u for u in users_list}
    out = []
    for r in items:
        u = users_by_id.get(r['user_id'])
        out.append({
            'id': r['id'],
            'user_id': r['user_id'],
            'plan': r['plan'],
            'price': r['price'],
            'status': r['status'],
            'created_at': r['created_at'],
            'user': public_user(u, u['id']) if u else None,
        })
    return out


@api.post('/admin/verification-requests/{req_id}/reject')
async def admin_reject_request(req_id: str, _=Depends(require_admin)):
    req = await db.verification_requests.find_one({'id': req_id})
    if not req:
        raise HTTPException(404, 'not_found')
    await db.verification_requests.update_one({'id': req_id}, {'$set': {'status': 'rejected', 'reviewed_at': now_utc()}})
    await db.users.update_one({'id': req['user_id']}, {'$set': {'verification_requested': False}})
    return {'rejected': True}


@api.get('/admin/tweets')
async def admin_tweets(q: str = '', skip: int = 0, limit: int = 50, _=Depends(require_admin)):
    query = {}
    if q:
        query = {'content': {'$regex': q, '$options': 'i'}}
    cursor = db.tweets.find(query).sort([('created_at', -1)]).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    return await serialize_tweets(items, None)


@api.delete('/admin/tweets/{tweet_id}')
async def admin_delete_tweet(tweet_id: str, _=Depends(require_admin)):
    await db.tweets.delete_one({'id': tweet_id})
    await db.tweets.delete_many({'parent_id': tweet_id})
    await db.likes.delete_many({'tweet_id': tweet_id})
    await db.retweets.delete_many({'tweet_id': tweet_id})
    return {'deleted': True}


# ------------- direct messages -------------

MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024  # ~4MB per attachment (base64 inflates ~33%)
MAX_TOTAL_MESSAGE_BYTES = 8 * 1024 * 1024


def _conv_key(a: str, b: str) -> list:
    """Canonical sorted participants list for stable conversation lookup."""
    return sorted([a, b])


async def _can_dm(sender: dict, recipient: dict) -> tuple[bool, str]:
    """Returns (allowed, reason). Followers-only privacy: sender must be followed by recipient."""
    if sender['id'] == recipient['id']:
        return False, 'cannot_dm_self'
    if recipient.get('banned'):
        return False, 'recipient_banned'
    privacy = recipient.get('dm_privacy', 'everyone')
    if privacy == 'everyone':
        return True, ''
    # followers-only: the recipient must be following the sender (i.e. sender has recipient as a follower)
    follow_doc = await db.follows.find_one({'follower_id': recipient['id'], 'following_id': sender['id']})
    if follow_doc:
        return True, ''
    return False, 'dm_restricted_to_followers'


def _serialize_message(m: dict) -> dict:
    return {
        'id': m['id'],
        'conversation_id': m['conversation_id'],
        'sender_id': m['sender_id'],
        'content': m.get('content', ''),
        'attachments': m.get('attachments', []),
        'created_at': m['created_at'],
        'read_by': m.get('read_by', []),
    }


async def _serialize_conversation(conv: dict, me_id: str) -> dict:
    other_id = next((p for p in conv['participants'] if p != me_id), None)
    other = await db.users.find_one({'id': other_id}) if other_id else None
    unread = await db.messages.count_documents({
        'conversation_id': conv['id'],
        'sender_id': {'$ne': me_id},
        'read_by': {'$ne': me_id},
    })
    return {
        'id': conv['id'],
        'peer': public_user(other, me_id) if other else None,
        'last_message_at': conv.get('last_message_at'),
        'last_message_preview': conv.get('last_message_preview', ''),
        'last_sender_id': conv.get('last_sender_id'),
        'unread_count': unread,
    }


@api.get('/messages/conversations')
async def list_conversations(user=Depends(current_user)):
    cur = db.conversations.find({'participants': user['id']}).sort([('last_message_at', -1)]).limit(100)
    items = await cur.to_list(100)
    return [await _serialize_conversation(c, user['id']) for c in items]


@api.get('/messages/unread-count')
async def messages_unread_count(user=Depends(current_user)):
    convs = await db.conversations.find({'participants': user['id']}, {'id': 1}).to_list(500)
    if not convs:
        return {'count': 0}
    conv_ids = [c['id'] for c in convs]
    count = await db.messages.count_documents({
        'conversation_id': {'$in': conv_ids},
        'sender_id': {'$ne': user['id']},
        'read_by': {'$ne': user['id']},
    })
    return {'count': count}


@api.post('/messages/conversations')
async def start_conversation(payload: ConversationStart, user=Depends(current_user)):
    target = await db.users.find_one({'username': payload.username})
    if not target:
        raise HTTPException(404, 'user_not_found')
    allowed, reason = await _can_dm(user, target)
    # Allow opening the conversation UI even if restricted, so the user can see the explanation.
    # The actual block happens on send.
    parts = _conv_key(user['id'], target['id'])
    existing = await db.conversations.find_one({'participants': parts})
    if existing:
        conv = existing
    else:
        conv = {
            'id': new_id(),
            'participants': parts,
            'created_at': now_utc(),
            'last_message_at': now_utc(),
            'last_message_preview': '',
            'last_sender_id': None,
        }
        await db.conversations.insert_one(conv)
    return {
        **(await _serialize_conversation(conv, user['id'])),
        'can_send': allowed,
        'block_reason': reason if not allowed else None,
    }


@api.get('/messages/conversations/{conv_id}')
async def get_conversation(conv_id: str, before: Optional[str] = None, limit: int = 50, user=Depends(current_user)):
    conv = await db.conversations.find_one({'id': conv_id})
    if not conv or user['id'] not in conv['participants']:
        raise HTTPException(404, 'conversation_not_found')
    q = {'conversation_id': conv_id}
    if before:
        before_msg = await db.messages.find_one({'id': before})
        if before_msg:
            q['created_at'] = {'$lt': before_msg['created_at']}
    cur = db.messages.find(q).sort([('created_at', -1)]).limit(min(limit, 100))
    msgs = await cur.to_list(min(limit, 100))
    msgs.reverse()  # chronological

    # peer info + can_send check
    other_id = next((p for p in conv['participants'] if p != user['id']), None)
    other = await db.users.find_one({'id': other_id}) if other_id else None
    allowed, reason = (True, '')
    if other:
        allowed, reason = await _can_dm(user, other)

    return {
        'id': conv['id'],
        'peer': public_user(other, user['id']) if other else None,
        'messages': [_serialize_message(m) for m in msgs],
        'can_send': allowed,
        'block_reason': reason if not allowed else None,
    }


@api.post('/messages/conversations/{conv_id}')
async def send_message(conv_id: str, payload: MessageCreate, user=Depends(current_user)):
    conv = await db.conversations.find_one({'id': conv_id})
    if not conv or user['id'] not in conv['participants']:
        raise HTTPException(404, 'conversation_not_found')
    other_id = next((p for p in conv['participants'] if p != user['id']), None)
    other = await db.users.find_one({'id': other_id}) if other_id else None
    if not other:
        raise HTTPException(404, 'recipient_not_found')
    allowed, reason = await _can_dm(user, other)
    if not allowed:
        raise HTTPException(403, reason or 'dm_blocked')

    content = (payload.content or '').strip()
    attachments = [a.model_dump() for a in payload.attachments]
    if not content and not attachments:
        raise HTTPException(400, 'empty_message')

    # Validate attachment sizes (base64 data URLs)
    total = len(content)
    for a in attachments:
        url = a.get('url', '') or ''
        size = len(url)
        if size > MAX_ATTACHMENT_BYTES * 2:  # base64 is ~1.33x; allow some headroom
            raise HTTPException(413, 'attachment_too_large')
        total += size
    if total > MAX_TOTAL_MESSAGE_BYTES * 2:
        raise HTTPException(413, 'message_too_large')

    now = now_utc()
    msg = {
        'id': new_id(),
        'conversation_id': conv_id,
        'sender_id': user['id'],
        'content': content,
        'attachments': attachments,
        'created_at': now,
        'read_by': [user['id']],
    }
    await db.messages.insert_one(msg)

    preview = content[:80] if content else (f"[{attachments[0].get('type','file')}]" if attachments else '')
    await db.conversations.update_one(
        {'id': conv_id},
        {'$set': {
            'last_message_at': now,
            'last_message_preview': preview,
            'last_sender_id': user['id'],
        }},
    )
    return _serialize_message(msg)


@api.post('/messages/conversations/{conv_id}/read')
async def mark_conversation_read(conv_id: str, user=Depends(current_user)):
    conv = await db.conversations.find_one({'id': conv_id})
    if not conv or user['id'] not in conv['participants']:
        raise HTTPException(404, 'conversation_not_found')
    await db.messages.update_many(
        {'conversation_id': conv_id, 'read_by': {'$ne': user['id']}},
        {'$addToSet': {'read_by': user['id']}},
    )
    return {'ok': True}


@api.delete('/messages/conversations/{conv_id}')
async def delete_conversation(conv_id: str, user=Depends(current_user)):
    """Hides conversation from the user (soft delete). Also deletes messages if no participants remain."""
    conv = await db.conversations.find_one({'id': conv_id})
    if not conv or user['id'] not in conv['participants']:
        raise HTTPException(404, 'conversation_not_found')
    remaining = [p for p in conv['participants'] if p != user['id']]
    if remaining:
        # Keep conversation but mark hidden for this user via a 'hidden_for' array
        await db.conversations.update_one(
            {'id': conv_id},
            {'$set': {'participants': remaining}, '$addToSet': {'hidden_for': user['id']}}
        )
    else:
        await db.conversations.delete_one({'id': conv_id})
        await db.messages.delete_many({'conversation_id': conv_id})
    return {'deleted': True}


# ------------- health -------------

@api.get('/')
async def root():
    return {'app': 'ksa1', 'version': '1.0', 'admin_email_configured': bool(ADMIN_EMAIL)}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.on_event('startup')
async def startup():
    await ensure_indexes()
    logger.info('ksa1 backend ready. Admin email: %s', ADMIN_EMAIL)


@app.on_event('shutdown')
async def shutdown():
    client.close()
