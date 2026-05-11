#!/usr/bin/env python3
"""
Backend API tests for ksa1 - Reserved Usernames and Follow Email Notification
"""
import requests
import time
from pymongo import MongoClient

BASE_URL = "https://social-feed-269.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

# Connect to MongoDB
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

def test_reserved_usernames_at_signup():
    """Test 1: Reserved usernames rejected at signup"""
    print("\n=== Test 1: Reserved usernames rejected at signup ===")
    
    reserved_tests = [
        ("admin", "admin@test.com", "Admin123!"),
        ("home", "home@test.com", "Home123!"),
        ("notifications", "notif@test.com", "Notif123!"),
        ("API", "api@test.com", "Api123!"),  # case insensitive
    ]
    
    for username, email, password in reserved_tests:
        payload = {
            "name": f"Test {username}",
            "username": username,
            "email": email,
            "password": password
        }
        resp = requests.post(f"{BASE_URL}/auth/signup/start", json=payload)
        if resp.status_code == 422:
            detail = resp.json().get('detail', [])
            if isinstance(detail, list) and len(detail) > 0:
                error_msg = detail[0].get('msg', '')
                if 'reserved' in error_msg.lower():
                    print(f"✅ username='{username}' correctly rejected with 422 (reserved)")
                else:
                    print(f"⚠️  username='{username}' rejected with 422 but message doesn't mention 'reserved': {error_msg}")
            else:
                print(f"✅ username='{username}' correctly rejected with 422")
        else:
            print(f"❌ username='{username}' should fail with 422 but got {resp.status_code}: {resp.text}")
    
    # Test valid username (not reserved)
    valid_payload = {
        "name": "Valid User",
        "username": "MyApp_2025",
        "email": f"validuser_{int(time.time())}@test.com",
        "password": "Valid123!"
    }
    resp = requests.post(f"{BASE_URL}/auth/signup/start", json=valid_payload)
    if resp.status_code == 200:
        print(f"✅ username='MyApp_2025' correctly accepted (not reserved)")
    else:
        print(f"❌ username='MyApp_2025' should pass but got {resp.status_code}: {resp.text}")


def test_reserved_usernames_at_check_username():
    """Test 2: Reserved usernames rejected at check-username"""
    print("\n=== Test 2: Reserved usernames rejected at check-username ===")
    
    # Test reserved usernames
    reserved_tests = ["admin", "explore"]
    for username in reserved_tests:
        payload = {"username": username}
        resp = requests.post(f"{BASE_URL}/auth/check-username", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            if not data.get('available') and data.get('reason') == 'reserved':
                print(f"✅ username='{username}' correctly marked as unavailable (reserved)")
            else:
                print(f"❌ username='{username}' should be unavailable with reason='reserved' but got: {data}")
        else:
            print(f"❌ check-username for '{username}' failed with {resp.status_code}: {resp.text}")
    
    # Test valid username
    valid_username = f"validname_{int(time.time())}"
    payload = {"username": valid_username}
    resp = requests.post(f"{BASE_URL}/auth/check-username", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        if data.get('available'):
            print(f"✅ username='{valid_username}' correctly marked as available")
        else:
            print(f"❌ username='{valid_username}' should be available but got: {data}")
    else:
        print(f"❌ check-username for '{valid_username}' failed with {resp.status_code}: {resp.text}")


def test_reserved_usernames_at_profile_update():
    """Test 3: Reserved usernames rejected at profile update"""
    print("\n=== Test 3: Reserved usernames rejected at profile update ===")
    
    # Create a valid user first
    timestamp = int(time.time()) % 100000  # Keep it short
    email = f"prof{timestamp}@test.com"
    username = f"prof{timestamp}"
    password = "Profile123!"
    
    # Signup start
    signup_payload = {
        "name": "Profile Test User",
        "username": username,
        "email": email,
        "password": password
    }
    resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_payload)
    if resp.status_code != 200:
        print(f"❌ Failed to start signup: {resp.status_code} {resp.text}")
        return
    
    # Get OTP from MongoDB
    otp_doc = db.otps.find_one({"email": email})
    if not otp_doc:
        print(f"❌ OTP not found in MongoDB for {email}")
        return
    
    otp_code = otp_doc['code']
    
    # Verify signup
    verify_payload = {
        "email": email,
        "code": otp_code
    }
    resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_payload)
    if resp.status_code != 200:
        print(f"❌ Failed to verify signup: {resp.status_code} {resp.text}")
        return
    
    token = resp.json()['token']
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to update to reserved usernames
    reserved_tests = ["admin", "messages"]
    for reserved_username in reserved_tests:
        update_payload = {"username": reserved_username}
        resp = requests.patch(f"{BASE_URL}/users/me", json=update_payload, headers=headers)
        if resp.status_code == 422:
            detail = resp.json().get('detail', [])
            if isinstance(detail, list) and len(detail) > 0:
                error_msg = detail[0].get('msg', '')
                if 'reserved' in error_msg.lower():
                    print(f"✅ PATCH /users/me with username='{reserved_username}' correctly rejected with 422 (reserved)")
                else:
                    print(f"⚠️  PATCH /users/me with username='{reserved_username}' rejected with 422 but message doesn't mention 'reserved': {error_msg}")
            else:
                print(f"✅ PATCH /users/me with username='{reserved_username}' correctly rejected with 422")
        else:
            print(f"❌ PATCH /users/me with username='{reserved_username}' should fail with 422 but got {resp.status_code}: {resp.text}")


def test_google_oauth_reserved_username():
    """Test 4: Google OAuth picks non-reserved username"""
    print("\n=== Test 4: Google OAuth picks non-reserved username ===")
    
    # Test with admin@example.com
    timestamp = int(time.time())
    payload = {
        "name": "Admin User",
        "email": f"admin_{timestamp}@example.com",
        "avatar": ""
    }
    resp = requests.post(f"{BASE_URL}/auth/google", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        username = data['user']['username']
        
        # Check if username is NOT in reserved list
        reserved_usernames = {
            'home', 'login', 'logout', 'signin', 'signup', 'register',
            'explore', 'notifications', 'messages', 'bookmarks', 'profile',
            'settings', 'admin', 'administrator', 'mod', 'moderator',
            'tweet', 'tweets', 'post', 'posts', 'status', 'statuses',
            'api', 'app', 'www', 'mail', 'email', 'support', 'help',
            'about', 'contact', 'terms', 'privacy', 'policy', 'tos',
            'search', 'discover', 'trending', 'topic', 'topics', 'tag', 'tags',
            'user', 'users', 'me', 'you', 'null', 'undefined', 'true', 'false',
            'ksa1', 'official', 'verified', 'staff', 'team', 'u',
        }
        
        if username.lower() not in reserved_usernames:
            print(f"✅ Google OAuth with email='admin_{timestamp}@example.com' generated non-reserved username: '{username}'")
        else:
            print(f"❌ Google OAuth generated reserved username: '{username}'")
    else:
        print(f"❌ Google OAuth failed with {resp.status_code}: {resp.text}")


def test_follow_email_notification():
    """Test 5: Follow email notification triggered"""
    print("\n=== Test 5: Follow email notification triggered ===")
    
    # Create user A
    timestamp = int(time.time()) % 100000  # Keep it short
    email_a = f"usera{timestamp}@test.com"
    username_a = f"usera{timestamp}"
    password_a = "UserA123!"
    
    signup_payload_a = {
        "name": "User A",
        "username": username_a,
        "email": email_a,
        "password": password_a
    }
    resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_payload_a)
    if resp.status_code != 200:
        print(f"❌ Failed to start signup for User A: {resp.status_code} {resp.text}")
        return
    
    otp_doc_a = db.otps.find_one({"email": email_a})
    if not otp_doc_a:
        print(f"❌ OTP not found for User A")
        return
    
    verify_payload_a = {"email": email_a, "code": otp_doc_a['code']}
    resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_payload_a)
    if resp.status_code != 200:
        print(f"❌ Failed to verify User A: {resp.status_code} {resp.text}")
        return
    
    token_a = resp.json()['token']
    
    # Create user B
    email_b = f"userb{timestamp}@test.com"
    username_b = f"userb{timestamp}"
    password_b = "UserB123!"
    
    signup_payload_b = {
        "name": "User B",
        "username": username_b,
        "email": email_b,
        "password": password_b
    }
    resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_payload_b)
    if resp.status_code != 200:
        print(f"❌ Failed to start signup for User B: {resp.status_code} {resp.text}")
        return
    
    otp_doc_b = db.otps.find_one({"email": email_b})
    if not otp_doc_b:
        print(f"❌ OTP not found for User B")
        return
    
    verify_payload_b = {"email": email_b, "code": otp_doc_b['code']}
    resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_payload_b)
    if resp.status_code != 200:
        print(f"❌ Failed to verify User B: {resp.status_code} {resp.text}")
        return
    
    # User A follows User B
    headers_a = {"Authorization": f"Bearer {token_a}"}
    resp = requests.post(f"{BASE_URL}/users/{username_b}/follow", headers=headers_a)
    if resp.status_code == 200:
        data = resp.json()
        if data.get('following') and data.get('target_followers_count') == 1:
            print(f"✅ User A followed User B successfully: {data}")
            print(f"   Email notification should be triggered in background (fire-and-forget)")
            print(f"   Check backend logs for SendGrid call (should NOT contain error in main response)")
        else:
            print(f"❌ Follow response unexpected: {data}")
    else:
        print(f"❌ Follow request failed with {resp.status_code}: {resp.text}")


def test_existing_endpoints():
    """Test 6: Existing endpoints still work"""
    print("\n=== Test 6: Existing endpoints still work ===")
    
    # Normal signup with valid username
    timestamp = int(time.time()) % 100000  # Keep it short
    email = f"norm{timestamp}@test.com"
    username = f"norm{timestamp}"
    password = "Normal123!"
    
    signup_payload = {
        "name": "Normal User",
        "username": username,
        "email": email,
        "password": password
    }
    resp = requests.post(f"{BASE_URL}/auth/signup/start", json=signup_payload)
    if resp.status_code != 200:
        print(f"❌ Normal signup failed: {resp.status_code} {resp.text}")
        return
    print(f"✅ Normal signup/start successful")
    
    # Get OTP and verify
    otp_doc = db.otps.find_one({"email": email})
    if not otp_doc:
        print(f"❌ OTP not found")
        return
    
    verify_payload = {"email": email, "code": otp_doc['code']}
    resp = requests.post(f"{BASE_URL}/auth/signup/verify", json=verify_payload)
    if resp.status_code != 200:
        print(f"❌ Signup verify failed: {resp.status_code} {resp.text}")
        return
    print(f"✅ Signup verify successful")
    
    token = resp.json()['token']
    
    # Login
    login_payload = {"email": email, "password": password}
    resp = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text}")
        return
    print(f"✅ Login successful")
    
    # GET /users/{username}
    resp = requests.get(f"{BASE_URL}/users/{username}")
    if resp.status_code != 200:
        print(f"❌ GET /users/{username} failed: {resp.status_code} {resp.text}")
        return
    print(f"✅ GET /users/{username} successful")
    
    # GET /users/{username}/followers
    resp = requests.get(f"{BASE_URL}/users/{username}/followers")
    if resp.status_code != 200:
        print(f"❌ GET /users/{username}/followers failed: {resp.status_code} {resp.text}")
        return
    print(f"✅ GET /users/{username}/followers successful")
    
    print(f"\n✅ All existing endpoints working correctly")


if __name__ == "__main__":
    print("=" * 80)
    print("Backend API Tests - Reserved Usernames and Follow Email Notification")
    print("=" * 80)
    
    try:
        test_reserved_usernames_at_signup()
        test_reserved_usernames_at_check_username()
        test_reserved_usernames_at_profile_update()
        test_google_oauth_reserved_username()
        test_follow_email_notification()
        test_existing_endpoints()
        
        print("\n" + "=" * 80)
        print("All tests completed!")
        print("=" * 80)
    except Exception as e:
        print(f"\n❌ Test suite failed with exception: {e}")
        import traceback
        traceback.print_exc()
