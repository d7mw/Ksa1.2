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
)
from auth_utils import (
    hash_password, verify_password, create_token, current_user,
    optional_user, require_admin, public_user, ADMIN_EMAIL,
)
from email_service import send_otp_email, send_password_reset_email

# Mongo
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
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
        base = email.split('@')[0]
        base = ''.join(c for c in base if c.isalnum() or c == '_').lower()[:20] or 'user'
        username = base
        i = 0
        while await db.users.find_one({'username': username}):
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
    from schemas import USERNAME_RE
    uname = payload.username.strip().lstrip('@').lower()
    if not USERNAME_RE.match(uname):
        return {'available': False, 'reason': 'invalid_format'}
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
        cursor = db.tweets.find({'parent_id': None}).sort([('likes_count', -1)]).limit(limit)
        items = await cursor.to_list(limit)
        return await serialize_tweets(items, viewer_id)

    cursor = db.tweets.find(q).sort([('created_at', -1)]).limit(limit)
    items = await cursor.to_list(limit)
    return await serialize_tweets(items, viewer_id)


@api.get('/tweets/{tweet_id}')
async def get_tweet(tweet_id: str, user=Depends(optional_user)):
    tw = await db.tweets.find_one({'id': tweet_id})
    if not tw:
        raise HTTPException(404, 'tweet_not_found')
    await db.tweets.update_one({'id': tweet_id}, {'$inc': {'views': 1}})
    tw['views'] = tw.get('views', 0) + 1
    viewer_id = user['id'] if user else None
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
        # Preserve like-order
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

    # Build combined sortable list: (sort_time, tweet_doc, retweeter_or_None)
    combined = []
    for t in own_items:
        combined.append((t['created_at'], t, None))
    for r in rt_docs:
        t = rt_tweets_by_id.get(r['tweet_id'])
        if t:
            combined.append((r['created_at'], t, u))
    # Sort by sort_time desc
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
