#!/usr/bin/env python3
"""
Test script to verify banned user filter in followers/following lists
"""

import requests
from pymongo import MongoClient
from datetime import datetime

# Configuration
BASE_URL = "https://social-feed-269.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def get_otp_from_db(email):
    """Fetch OTP from MongoDB"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    otp_doc = db.otps.find_one({'email': email.lower()}, sort=[('created_at', -1)])
    client.close()
    if otp_doc:
        return otp_doc['code']
    return None

def signup_user(email, password, name, username):
    """Complete signup flow"""
    resp = requests.post(f"{BASE_URL}/auth/signup/start", json={
        'email': email,
        'password': password,
        'name': name,
        'username': username
    })
    
    if resp.status_code != 200:
        return None
    
    otp = get_otp_from_db(email)
    if not otp:
        return None
    
    resp = requests.post(f"{BASE_URL}/auth/signup/verify", json={
        'email': email,
        'code': otp
    })
    
    if resp.status_code != 200:
        return None
    
    return resp.json()

def main():
    log("=" * 80)
    log("BANNED USER FILTER TEST")
    log("=" * 80)
    
    # Create 2 test users
    log("\n📝 Creating test users...")
    
    # Cleanup first
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    db.users.delete_many({'email': {'$in': ['ban_test_a@example.com', 'ban_test_b@example.com']}})
    client.close()
    
    user_a = signup_user('ban_test_a@example.com', 'TestPass123!', 'Ban Test A', 'ban_test_a')
    user_b = signup_user('ban_test_b@example.com', 'TestPass123!', 'Ban Test B', 'ban_test_b')
    
    if not user_a or not user_b:
        log("❌ Failed to create test users")
        return 1
    
    log(f"✅ Created test users A and B")
    
    # User A follows User B
    log("\n📝 User A follows User B...")
    resp = requests.post(
        f"{BASE_URL}/users/ban_test_b/follow",
        headers={'Authorization': f'Bearer {user_a["token"]}'}
    )
    if resp.status_code != 200:
        log(f"❌ Follow failed: {resp.status_code} {resp.text}")
        return 1
    log(f"✅ User A followed User B")
    
    # Verify User B appears in User A's following list
    log("\n📝 Checking User A's following list (before ban)...")
    resp = requests.get(f"{BASE_URL}/users/ban_test_a/following")
    if resp.status_code != 200:
        log(f"❌ Get following failed: {resp.status_code} {resp.text}")
        return 1
    
    following = resp.json()
    if len(following) != 1 or following[0]['id'] != user_b['user']['id']:
        log(f"❌ Expected User B in following list, got: {following}")
        return 1
    log(f"✅ User B appears in User A's following list")
    
    # Ban User B directly in database
    log("\n📝 Banning User B directly in database...")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    result = db.users.update_one(
        {'id': user_b['user']['id']},
        {'$set': {'banned': True}}
    )
    client.close()
    
    if result.modified_count != 1:
        log(f"❌ Failed to ban User B in database")
        return 1
    log(f"✅ User B banned in database")
    
    # Verify User B does NOT appear in User A's following list
    log("\n📝 Checking User A's following list (after ban)...")
    resp = requests.get(f"{BASE_URL}/users/ban_test_a/following")
    if resp.status_code != 200:
        log(f"❌ Get following failed: {resp.status_code} {resp.text}")
        return 1
    
    following = resp.json()
    if len(following) != 0:
        log(f"❌ Expected empty following list (banned user filtered), got: {following}")
        return 1
    log(f"✅ Banned User B does NOT appear in User A's following list")
    
    # Verify User A does NOT appear in User B's followers list
    log("\n📝 Checking User B's followers list (User B is banned)...")
    resp = requests.get(f"{BASE_URL}/users/ban_test_b/followers")
    if resp.status_code != 200:
        log(f"❌ Get followers failed: {resp.status_code} {resp.text}")
        return 1
    
    followers = resp.json()
    # User A should still appear because User A is not banned
    if len(followers) != 1 or followers[0]['id'] != user_a['user']['id']:
        log(f"❌ Expected User A in followers list, got: {followers}")
        return 1
    log(f"✅ User A still appears in User B's followers list (User A is not banned)")
    
    # Now ban User A and check User B's followers list
    log("\n📝 Banning User A in database...")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    result = db.users.update_one(
        {'id': user_a['user']['id']},
        {'$set': {'banned': True}}
    )
    client.close()
    
    if result.modified_count != 1:
        log(f"❌ Failed to ban User A in database")
        return 1
    log(f"✅ User A banned in database")
    
    # Verify User A does NOT appear in User B's followers list
    log("\n📝 Checking User B's followers list (after banning User A)...")
    resp = requests.get(f"{BASE_URL}/users/ban_test_b/followers")
    if resp.status_code != 200:
        log(f"❌ Get followers failed: {resp.status_code} {resp.text}")
        return 1
    
    followers = resp.json()
    if len(followers) != 0:
        log(f"❌ Expected empty followers list (banned user filtered), got: {followers}")
        return 1
    log(f"✅ Banned User A does NOT appear in User B's followers list")
    
    # Cleanup
    log("\n📝 Cleaning up test users...")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    db.users.delete_many({'email': {'$in': ['ban_test_a@example.com', 'ban_test_b@example.com']}})
    client.close()
    log(f"✅ Test users cleaned up")
    
    log("\n" + "=" * 80)
    log("🎉 BANNED USER FILTER TEST PASSED!")
    log("=" * 80)
    
    return 0

if __name__ == '__main__':
    import sys
    try:
        sys.exit(main())
    except Exception as e:
        log(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
