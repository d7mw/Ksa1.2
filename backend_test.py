#!/usr/bin/env python3
"""
Comprehensive backend test suite for ksa1 Twitter-like API
Tests all endpoints as specified in the review request
"""

import requests
import pymongo
import time
import json
from typing import Optional

# Configuration
BASE_URL = "https://social-feed-269.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"
ADMIN_EMAIL = "sfa6664@gmail.com"

# Test data storage
test_data = {
    'tokens': {},
    'users': {},
    'tweets': {},
}

def log(msg: str, level: str = "INFO"):
    """Log test messages"""
    print(f"[{level}] {msg}")

def get_otp_from_db(email: str) -> Optional[str]:
    """Query MongoDB directly to get OTP code"""
    try:
        client = pymongo.MongoClient(MONGO_URL)
        db = client[DB_NAME]
        otp_doc = db.otps.find_one({'email': email.lower()})
        client.close()
        if otp_doc:
            return otp_doc['code']
        return None
    except Exception as e:
        log(f"Error getting OTP from DB: {e}", "ERROR")
        return None

def test_health_check():
    """Test 1: GET /api/ - health check"""
    log("\n=== Test 1: Health Check ===")
    try:
        resp = requests.get(f"{BASE_URL}/")
        log(f"Status: {resp.status_code}")
        data = resp.json()
        log(f"Response: {json.dumps(data, indent=2)}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get('app') == 'ksa1', f"Expected app=ksa1, got {data.get('app')}"
        assert data.get('admin_email_configured') == True, "Admin email not configured"
        
        log("✅ Health check passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Health check failed: {e}", "ERROR")
        return False

def test_username_uniqueness():
    """Test 2: Username uniqueness check"""
    log("\n=== Test 2: Username Uniqueness Check ===")
    try:
        # Test available username
        resp = requests.post(f"{BASE_URL}/auth/check-username", json={"username": "testuser1"})
        log(f"Check testuser1 - Status: {resp.status_code}, Response: {resp.json()}")
        data = resp.json()
        assert data.get('available') == True, "testuser1 should be available"
        
        # Register a user first
        signup_data = {
            "name": "Test User One",
            "username": "testuser1",
            "email": "testuser1@example.com",
            "password": "password123"
        }
        resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_data)
        log(f"Signup start - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Signup failed: {resp.text}"
        
        # Get OTP from DB
        time.sleep(1)
        otp = get_otp_from_db("testuser1@example.com")
        assert otp, "OTP not found in database"
        log(f"Retrieved OTP: {otp}")
        
        # Verify signup
        verify_data = {"email": "testuser1@example.com", "code": otp}
        resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_data)
        log(f"Signup verify - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Verify failed: {resp.text}"
        data = resp.json()
        test_data['tokens']['testuser1'] = data['token']
        test_data['users']['testuser1'] = data['user']
        
        # Now check username again - should be taken
        resp = requests.post(f"{BASE_URL}/auth/check-username", json={"username": "testuser1"})
        log(f"Check testuser1 again - Status: {resp.status_code}, Response: {resp.json()}")
        data = resp.json()
        assert data.get('available') == False, "testuser1 should be taken"
        assert data.get('reason') == 'taken', f"Expected reason=taken, got {data.get('reason')}"
        
        # Test invalid format
        resp = requests.post(f"{BASE_URL}/auth/check-username", json={"username": "ab"})
        log(f"Check 'ab' (invalid) - Status: {resp.status_code}, Response: {resp.json()}")
        data = resp.json()
        assert data.get('available') == False, "Short username should be invalid"
        assert data.get('reason') == 'invalid_format', f"Expected invalid_format, got {data.get('reason')}"
        
        log("✅ Username uniqueness check passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Username uniqueness check failed: {e}", "ERROR")
        return False

def test_signup_flow():
    """Test 3: Signup flow with OTP"""
    log("\n=== Test 3: Signup Flow with OTP ===")
    try:
        # Try to signup with same email - should fail
        signup_data = {
            "name": "Test User Duplicate",
            "username": "testuser2",
            "email": "testuser1@example.com",
            "password": "password123"
        }
        resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_data)
        log(f"Duplicate email - Status: {resp.status_code}")
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
        assert 'email_taken' in resp.text, "Expected email_taken error"
        
        # Try with same username, different email
        signup_data = {
            "name": "Test User Duplicate",
            "username": "testuser1",
            "email": "testuser2@example.com",
            "password": "password123"
        }
        resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_data)
        log(f"Duplicate username - Status: {resp.status_code}")
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
        assert 'username_taken' in resp.text, "Expected username_taken error"
        
        # Valid signup
        signup_data = {
            "name": "Test User Two",
            "username": "testuser2",
            "email": "testuser2@example.com",
            "password": "password123"
        }
        resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_data)
        log(f"Valid signup - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Signup failed: {resp.text}"
        
        # Get OTP
        time.sleep(1)
        otp = get_otp_from_db("testuser2@example.com")
        assert otp, "OTP not found"
        
        # Try invalid code
        verify_data = {"email": "testuser2@example.com", "code": "000000"}
        resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_data)
        log(f"Invalid code - Status: {resp.status_code}")
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert 'invalid_code' in resp.text, "Expected invalid_code error"
        
        # Valid code
        verify_data = {"email": "testuser2@example.com", "code": otp}
        resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_data)
        log(f"Valid code - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Verify failed: {resp.text}"
        data = resp.json()
        assert 'token' in data, "Token not returned"
        assert 'user' in data, "User not returned"
        test_data['tokens']['testuser2'] = data['token']
        test_data['users']['testuser2'] = data['user']
        
        log("✅ Signup flow passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Signup flow failed: {e}", "ERROR")
        return False

def test_admin_detection():
    """Test 4: Admin auto-detection"""
    log("\n=== Test 4: Admin Auto-Detection ===")
    try:
        # Signup with admin email
        signup_data = {
            "name": "Admin User",
            "username": "adminuser",
            "email": ADMIN_EMAIL,
            "password": "adminpass123"
        }
        resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_data)
        log(f"Admin signup - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Admin signup failed: {resp.text}"
        
        # Get OTP
        time.sleep(1)
        otp = get_otp_from_db(ADMIN_EMAIL)
        assert otp, "Admin OTP not found"
        
        # Verify
        verify_data = {"email": ADMIN_EMAIL, "code": otp}
        resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_data)
        log(f"Admin verify - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Admin verify failed: {resp.text}"
        data = resp.json()
        test_data['tokens']['admin'] = data['token']
        test_data['users']['admin'] = data['user']
        
        # Check /auth/me
        headers = {"Authorization": f"Bearer {data['token']}"}
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        log(f"Auth me - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Auth me failed: {resp.text}"
        user_data = resp.json()
        assert user_data.get('is_admin') == True, f"User should be admin, got is_admin={user_data.get('is_admin')}"
        
        log("✅ Admin detection passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Admin detection failed: {e}", "ERROR")
        return False

def test_login():
    """Test 5: Login"""
    log("\n=== Test 5: Login ===")
    try:
        # Wrong password
        login_data = {"email": "testuser1@example.com", "password": "wrongpassword"}
        resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        log(f"Wrong password - Status: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        assert 'invalid_credentials' in resp.text, "Expected invalid_credentials error"
        
        # Non-existent email
        login_data = {"email": "nonexistent@example.com", "password": "password123"}
        resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        log(f"Non-existent email - Status: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        
        # Correct credentials
        login_data = {"email": "testuser1@example.com", "password": "password123"}
        resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        log(f"Correct credentials - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert 'token' in data, "Token not returned"
        
        log("✅ Login passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Login failed: {e}", "ERROR")
        return False

def test_google_oauth():
    """Test 6: Google OAuth"""
    log("\n=== Test 6: Google OAuth ===")
    try:
        google_data = {
            "name": "Google User",
            "email": "googleuser@gmail.com",
            "avatar": "https://example.com/avatar.jpg"
        }
        resp = requests.post(f"{BASE_URL}/auth/google", json=google_data)
        log(f"Google OAuth - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Google OAuth failed: {resp.text}"
        data = resp.json()
        assert 'token' in data, "Token not returned"
        assert 'user' in data, "User not returned"
        assert data['user']['username'], "Username not auto-generated"
        test_data['tokens']['googleuser'] = data['token']
        test_data['users']['googleuser'] = data['user']
        
        log("✅ Google OAuth passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Google OAuth failed: {e}", "ERROR")
        return False

def test_profile_update_username():
    """Test 7: Profile update with username uniqueness"""
    log("\n=== Test 7: Profile Update with Username Uniqueness ===")
    try:
        # Create user A and B (already have testuser1 and testuser2)
        user_a_token = test_data['tokens']['testuser1']
        user_b_token = test_data['tokens']['testuser2']
        
        # User A tries to change username to user B's username
        headers = {"Authorization": f"Bearer {user_a_token}"}
        update_data = {"username": "testuser2"}
        resp = requests.patch(f"{BASE_URL}/users/me", json=update_data, headers=headers)
        log(f"User A -> User B username - Status: {resp.status_code}")
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
        assert 'username_taken' in resp.text, "Expected username_taken error"
        
        # User A changes to free username
        update_data = {"username": "testuser1_new"}
        resp = requests.patch(f"{BASE_URL}/users/me", json=update_data, headers=headers)
        log(f"User A -> new username - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Update failed: {resp.text}"
        data = resp.json()
        assert data['username'] == 'testuser1_new', f"Username not updated, got {data['username']}"
        
        # User B changes to old username of A (testuser1)
        headers_b = {"Authorization": f"Bearer {user_b_token}"}
        update_data = {"username": "testuser1"}
        resp = requests.patch(f"{BASE_URL}/users/me", json=update_data, headers=headers_b)
        log(f"User B -> User A old username - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Update failed: {resp.text}"
        data = resp.json()
        assert data['username'] == 'testuser1', f"Username not updated, got {data['username']}"
        
        log("✅ Profile update with username uniqueness passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Profile update failed: {e}", "ERROR")
        return False

def test_tweet_crud():
    """Test 8: Tweet CRUD"""
    log("\n=== Test 8: Tweet CRUD ===")
    try:
        token = test_data['tokens']['testuser1_new'] if 'testuser1_new' in test_data['tokens'] else test_data['tokens']['testuser1']
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create tweet
        tweet_data = {"content": "Hello from test"}
        resp = requests.post(f"{BASE_URL}/tweets", json=tweet_data, headers=headers)
        log(f"Create tweet - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Create tweet failed: {resp.text}"
        data = resp.json()
        assert 'id' in data, "Tweet ID not returned"
        tweet_id = data['id']
        test_data['tweets']['test_tweet'] = tweet_id
        
        # Get feed
        resp = requests.get(f"{BASE_URL}/tweets/feed")
        log(f"Get feed - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Get feed failed: {resp.text}"
        tweets = resp.json()
        assert isinstance(tweets, list), "Feed should be an array"
        assert any(t['id'] == tweet_id for t in tweets), "Tweet not in feed"
        
        # Like tweet
        resp = requests.post(f"{BASE_URL}/tweets/{tweet_id}/like", headers=headers)
        log(f"Like tweet - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Like failed: {resp.text}"
        data = resp.json()
        assert data.get('liked') == True, "Tweet should be liked"
        
        # Unlike tweet
        resp = requests.post(f"{BASE_URL}/tweets/{tweet_id}/like", headers=headers)
        log(f"Unlike tweet - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Unlike failed: {resp.text}"
        data = resp.json()
        assert data.get('liked') == False, "Tweet should be unliked"
        
        # Get tweet (views should increase)
        resp = requests.get(f"{BASE_URL}/tweets/{tweet_id}")
        log(f"Get tweet - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Get tweet failed: {resp.text}"
        data = resp.json()
        assert data['views'] > 0, "Views should increase"
        
        # Delete tweet
        resp = requests.delete(f"{BASE_URL}/tweets/{tweet_id}", headers=headers)
        log(f"Delete tweet - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Delete failed: {resp.text}"
        
        log("✅ Tweet CRUD passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Tweet CRUD failed: {e}", "ERROR")
        return False

def test_follow_flow():
    """Test 9: Follow flow"""
    log("\n=== Test 9: Follow Flow ===")
    try:
        # Use testuser1_new (A) and testuser1 (B)
        token_a = test_data['tokens']['testuser1_new'] if 'testuser1_new' in test_data['tokens'] else test_data['tokens']['testuser1']
        headers_a = {"Authorization": f"Bearer {token_a}"}
        username_b = "testuser1"  # User B took testuser1 username
        
        # User A follows user B
        resp = requests.post(f"{BASE_URL}/users/{username_b}/follow", headers=headers_a)
        log(f"Follow user - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Follow failed: {resp.text}"
        data = resp.json()
        assert data.get('following') == True, "Should be following"
        
        # Get user B profile as A
        resp = requests.get(f"{BASE_URL}/users/{username_b}", headers=headers_a)
        log(f"Get user profile - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Get user failed: {resp.text}"
        data = resp.json()
        assert data.get('is_following') == True, "Should show is_following=true"
        assert data.get('followers_count', 0) > 0, "Followers count should increase"
        
        # Unfollow
        resp = requests.post(f"{BASE_URL}/users/{username_b}/follow", headers=headers_a)
        log(f"Unfollow user - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Unfollow failed: {resp.text}"
        data = resp.json()
        assert data.get('following') == False, "Should not be following"
        
        log("✅ Follow flow passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Follow flow failed: {e}", "ERROR")
        return False

def test_notifications():
    """Test 10: Notifications"""
    log("\n=== Test 10: Notifications ===")
    try:
        # Create a tweet as user A
        token_a = test_data['tokens']['testuser1_new'] if 'testuser1_new' in test_data['tokens'] else test_data['tokens']['testuser1']
        headers_a = {"Authorization": f"Bearer {token_a}"}
        
        tweet_data = {"content": "Test notification tweet"}
        resp = requests.post(f"{BASE_URL}/tweets", json=tweet_data, headers=headers_a)
        assert resp.status_code == 200, f"Create tweet failed: {resp.text}"
        tweet_id = resp.json()['id']
        
        # User B likes the tweet
        token_b = test_data['tokens']['testuser2']
        headers_b = {"Authorization": f"Bearer {token_b}"}
        resp = requests.post(f"{BASE_URL}/tweets/{tweet_id}/like", headers=headers_b)
        log(f"User B likes tweet - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Like failed: {resp.text}"
        
        # User A gets notifications
        time.sleep(1)  # Give time for notification to be created
        resp = requests.get(f"{BASE_URL}/notifications", headers=headers_a)
        log(f"Get notifications - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Get notifications failed: {resp.text}"
        notifications = resp.json()
        assert isinstance(notifications, list), "Notifications should be an array"
        
        # Check if there's a like notification
        like_notif = [n for n in notifications if n.get('type') == 'like']
        log(f"Found {len(like_notif)} like notifications")
        assert len(like_notif) > 0, "Should have at least one like notification"
        
        log("✅ Notifications passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Notifications failed: {e}", "ERROR")
        return False

def test_verification_request():
    """Test 11: Verification request"""
    log("\n=== Test 11: Verification Request ===")
    try:
        # User requests verification
        token = test_data['tokens']['testuser2']
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.post(f"{BASE_URL}/users/me/request-verification?plan=monthly", headers=headers)
        log(f"Request verification - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Request verification failed: {resp.text}"
        data = resp.json()
        assert data.get('status') == 'pending', f"Expected status=pending, got {data.get('status')}"
        
        # Admin gets verification requests
        admin_token = test_data['tokens']['admin']
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/admin/verification-requests", headers=admin_headers)
        log(f"Get verification requests - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Get requests failed: {resp.text}"
        requests_list = resp.json()
        assert isinstance(requests_list, list), "Should be an array"
        assert len(requests_list) > 0, "Should have at least one request"
        
        # Admin verifies user
        user_id = test_data['users']['testuser2']['id']
        resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/verify", headers=admin_headers)
        log(f"Admin verify user - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Verify failed: {resp.text}"
        data = resp.json()
        assert data.get('verified') == True, "User should be verified"
        
        # User tries to request again
        resp = requests.post(f"{BASE_URL}/users/me/request-verification?plan=monthly", headers=headers)
        log(f"Request again - Status: {resp.status_code}")
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert 'already_verified' in resp.text, "Expected already_verified error"
        
        log("✅ Verification request passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Verification request failed: {e}", "ERROR")
        return False

def test_admin_actions():
    """Test 12: Admin actions"""
    log("\n=== Test 12: Admin Actions ===")
    try:
        admin_token = test_data['tokens']['admin']
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get admin stats
        resp = requests.get(f"{BASE_URL}/admin/stats", headers=admin_headers)
        log(f"Admin stats - Status: {resp.status_code}, Response: {resp.json()}")
        assert resp.status_code == 200, f"Get stats failed: {resp.text}"
        stats = resp.json()
        assert 'users' in stats, "Stats should have users count"
        assert 'tweets' in stats, "Stats should have tweets count"
        
        # Get admin users
        resp = requests.get(f"{BASE_URL}/admin/users", headers=admin_headers)
        log(f"Admin users - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Get users failed: {resp.text}"
        users = resp.json()
        assert isinstance(users, list), "Should be an array"
        
        # Ban a user
        user_id = test_data['users']['googleuser']['id']
        resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/ban", headers=admin_headers)
        log(f"Ban user - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Ban failed: {resp.text}"
        data = resp.json()
        assert data.get('banned') == True, "User should be banned"
        
        # Banned user tries to login
        login_data = {"email": "googleuser@gmail.com", "password": "anypassword"}
        resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        log(f"Banned user login - Status: {resp.status_code}")
        # Note: Google user doesn't have password, so this will fail differently
        # Let's try with Google OAuth instead
        google_data = {
            "name": "Google User",
            "email": "googleuser@gmail.com"
        }
        resp = requests.post(f"{BASE_URL}/auth/google", json=google_data)
        log(f"Banned user Google OAuth - Status: {resp.status_code}")
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        assert 'account_banned' in resp.text, "Expected account_banned error"
        
        # Unban user
        resp = requests.post(f"{BASE_URL}/admin/users/{user_id}/unban", headers=admin_headers)
        log(f"Unban user - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Unban failed: {resp.text}"
        data = resp.json()
        assert data.get('banned') == False, "User should be unbanned"
        
        # Create a tweet to delete
        token = test_data['tokens']['testuser2']
        headers = {"Authorization": f"Bearer {token}"}
        tweet_data = {"content": "Tweet to be deleted by admin"}
        resp = requests.post(f"{BASE_URL}/tweets", json=tweet_data, headers=headers)
        assert resp.status_code == 200, f"Create tweet failed: {resp.text}"
        tweet_id = resp.json()['id']
        
        # Admin deletes tweet
        resp = requests.delete(f"{BASE_URL}/admin/tweets/{tweet_id}", headers=admin_headers)
        log(f"Admin delete tweet - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Delete tweet failed: {resp.text}"
        
        # Non-admin tries to access admin endpoint
        non_admin_token = test_data['tokens']['testuser2']
        non_admin_headers = {"Authorization": f"Bearer {non_admin_token}"}
        resp = requests.get(f"{BASE_URL}/admin/stats", headers=non_admin_headers)
        log(f"Non-admin access - Status: {resp.status_code}")
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        
        log("✅ Admin actions passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Admin actions failed: {e}", "ERROR")
        return False

def test_search():
    """Test 13: Search"""
    log("\n=== Test 13: Search ===")
    try:
        # Create a tweet with searchable content
        token = test_data['tokens']['testuser2']
        headers = {"Authorization": f"Bearer {token}"}
        tweet_data = {"content": "Hello world this is a searchable tweet"}
        resp = requests.post(f"{BASE_URL}/tweets", json=tweet_data, headers=headers)
        assert resp.status_code == 200, f"Create tweet failed: {resp.text}"
        
        time.sleep(1)  # Give time for tweet to be indexed
        
        # Search tweets
        resp = requests.get(f"{BASE_URL}/search/tweets?q=hello")
        log(f"Search tweets - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Search tweets failed: {resp.text}"
        tweets = resp.json()
        assert isinstance(tweets, list), "Should be an array"
        log(f"Found {len(tweets)} tweets matching 'hello'")
        
        # Search users
        resp = requests.get(f"{BASE_URL}/search/users?q=test")
        log(f"Search users - Status: {resp.status_code}")
        assert resp.status_code == 200, f"Search users failed: {resp.text}"
        users = resp.json()
        assert isinstance(users, list), "Should be an array"
        log(f"Found {len(users)} users matching 'test'")
        
        log("✅ Search passed", "SUCCESS")
        return True
    except Exception as e:
        log(f"❌ Search failed: {e}", "ERROR")
        return False

def main():
    """Run all tests"""
    log("=" * 60)
    log("Starting ksa1 Backend Test Suite")
    log("=" * 60)
    
    results = {}
    
    # Run tests in order
    tests = [
        ("Health Check", test_health_check),
        ("Username Uniqueness", test_username_uniqueness),
        ("Signup Flow", test_signup_flow),
        ("Admin Detection", test_admin_detection),
        ("Login", test_login),
        ("Google OAuth", test_google_oauth),
        ("Profile Update", test_profile_update_username),
        ("Tweet CRUD", test_tweet_crud),
        ("Follow Flow", test_follow_flow),
        ("Notifications", test_notifications),
        ("Verification Request", test_verification_request),
        ("Admin Actions", test_admin_actions),
        ("Search", test_search),
    ]
    
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            log(f"Test {test_name} crashed: {e}", "ERROR")
            results[test_name] = False
    
    # Summary
    log("\n" + "=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{test_name}: {status}")
    
    log(f"\nTotal: {passed}/{total} tests passed")
    log("=" * 60)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
