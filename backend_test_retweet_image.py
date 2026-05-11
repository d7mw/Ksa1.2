#!/usr/bin/env python3
"""
Backend API Testing for ksa1 - Retweet and Image Upload
Tests retweet endpoint and image upload functionality
"""

import requests
import sys
import base64
from pymongo import MongoClient
from datetime import datetime, timezone

# Configuration
BACKEND_URL = "https://social-feed-269.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

# MongoDB client
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(name, passed, details=""):
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        status = "✅ PASS"
    else:
        tests_failed += 1
        status = "❌ FAIL"
    
    result = f"{status}: {name}"
    if details:
        result += f"\n    {details}"
    test_results.append(result)
    print(result)

def register_and_login_user(email, username, password):
    """Helper: Register and login a user"""
    print(f"\n=== Registering and logging in user: {email} ===")
    
    # Clean up existing user
    db.users.delete_many({"email": email})
    db.otps.delete_many({"email": email})
    
    # Step 1: Start signup
    response = requests.post(
        f"{BACKEND_URL}/auth/signup/start",
        json={
            "name": username.capitalize(),
            "username": username,
            "email": email,
            "password": password
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Signup start failed: {response.status_code} - {response.text}")
        return None
    
    # Step 2: Get OTP from MongoDB
    otp_record = db.otps.find_one({"email": email})
    if not otp_record:
        print(f"❌ No OTP found in MongoDB for {email}")
        return None
    
    code = otp_record["code"]
    
    # Step 3: Verify OTP
    response = requests.post(
        f"{BACKEND_URL}/auth/signup/verify",
        json={
            "email": email,
            "code": code
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Signup verify failed: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    token = data.get("token")
    user = data.get("user")
    
    print(f"✅ User registered and logged in: {user['username']}")
    return {"token": token, "user": user}

def create_tweet(token, content, image=None):
    """Helper: Create a tweet"""
    payload = {"content": content}
    if image:
        payload["image"] = image
    
    response = requests.post(
        f"{BACKEND_URL}/tweets",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Failed to create tweet: {response.status_code} - {response.text}")
        return None

def generate_small_base64_image():
    """Generate a small valid base64 PNG image (100x100, ~5KB)"""
    # This is a minimal 1x1 red PNG image in base64
    # For a more realistic test, we'll create a slightly larger one
    small_png = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    )
    # Repeat to make it larger (~5KB)
    return "data:image/png;base64," + (small_png * 100)

def generate_large_base64_image():
    """Generate a large base64 image (>7.5MB)"""
    # Create a string that's definitely over 7.5MB
    large_data = "A" * 8_000_000  # 8MB of 'A' characters
    return "data:image/png;base64," + large_data

def test_retweet_flow():
    """Test 1-7: Complete retweet flow"""
    print("\n" + "=" * 80)
    print("TEST 1-7: RETWEET FLOW")
    print("=" * 80)
    
    # Create User A
    user_a = register_and_login_user("usera@example.com", "usera", "password123")
    if not user_a:
        log_test("Create User A", False, "Failed to register User A")
        return
    log_test("Create User A", True, f"User A created: {user_a['user']['username']}")
    
    # User A creates a tweet
    tweet = create_tweet(user_a["token"], "Test tweet for retweet")
    if not tweet:
        log_test("User A creates tweet", False, "Failed to create tweet")
        return
    log_test("User A creates tweet", True, f"Tweet created: {tweet['id']}")
    tweet_id = tweet["id"]
    
    # Create User B
    user_b = register_and_login_user("userb@example.com", "userb", "password123")
    if not user_b:
        log_test("Create User B", False, "Failed to register User B")
        return
    log_test("Create User B", True, f"User B created: {user_b['user']['username']}")
    
    # Test 1: User B retweets the tweet
    response = requests.post(
        f"{BACKEND_URL}/tweets/{tweet_id}/retweet",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("retweeted") == True:
            log_test("User B retweets tweet", True, "Returns {retweeted: true}")
        else:
            log_test("User B retweets tweet", False, f"Expected retweeted=true, got {data}")
    else:
        log_test("User B retweets tweet", False, f"Status {response.status_code}: {response.text}")
    
    # Test 2: Check retweets_count increased to 1
    response = requests.get(
        f"{BACKEND_URL}/tweets/{tweet_id}",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("retweets_count") == 1 and data.get("retweeted") == True:
            log_test("Retweets count increased to 1", True, 
                     f"retweets_count=1, retweeted=true for User B")
        else:
            log_test("Retweets count increased to 1", False,
                     f"Expected retweets_count=1 and retweeted=true, got {data}")
    else:
        log_test("Retweets count increased to 1", False, 
                 f"Status {response.status_code}: {response.text}")
    
    # Test 3: User B retweets again (should unretweet)
    response = requests.post(
        f"{BACKEND_URL}/tweets/{tweet_id}/retweet",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("retweeted") == False:
            log_test("User B unretweets tweet", True, "Returns {retweeted: false}")
        else:
            log_test("User B unretweets tweet", False, f"Expected retweeted=false, got {data}")
    else:
        log_test("User B unretweets tweet", False, f"Status {response.status_code}: {response.text}")
    
    # Test 4: Check retweets_count decreased to 0
    response = requests.get(
        f"{BACKEND_URL}/tweets/{tweet_id}",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("retweets_count") == 0 and data.get("retweeted") == False:
            log_test("Retweets count decreased to 0", True,
                     f"retweets_count=0, retweeted=false for User B")
        else:
            log_test("Retweets count decreased to 0", False,
                     f"Expected retweets_count=0 and retweeted=false, got {data}")
    else:
        log_test("Retweets count decreased to 0", False,
                 f"Status {response.status_code}: {response.text}")
    
    # Test 5: User A retweets own tweet (should NOT create notification)
    # First, get current notification count
    response = requests.get(
        f"{BACKEND_URL}/notifications",
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    
    notifications_before = []
    if response.status_code == 200:
        notifications_before = response.json()
    
    # Now User A retweets their own tweet
    response = requests.post(
        f"{BACKEND_URL}/tweets/{tweet_id}/retweet",
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("retweeted") == True:
            # Check notifications - should NOT have NEW retweet notification from self
            response = requests.get(
                f"{BACKEND_URL}/notifications",
                headers={"Authorization": f"Bearer {user_a['token']}"}
            )
            
            if response.status_code == 200:
                notifications_after = response.json()
                # Check for retweet notifications where actor is User A (self)
                self_retweet_notifs = [n for n in notifications_after 
                                      if n.get("type") == "retweet" 
                                      and n.get("actor", {}).get("id") == user_a["user"]["id"]]
                
                if len(self_retweet_notifs) == 0:
                    log_test("User A retweets own tweet - no self-notification", True,
                             "No retweet notification created for self-retweet")
                else:
                    log_test("User A retweets own tweet - no self-notification", False,
                             f"Found {len(self_retweet_notifs)} self-retweet notifications (should be 0)")
            else:
                log_test("User A retweets own tweet - no self-notification", False,
                         f"Failed to get notifications: {response.status_code}")
        else:
            log_test("User A retweets own tweet - no self-notification", False,
                     f"Failed to retweet: {data}")
    else:
        log_test("User A retweets own tweet - no self-notification", False,
                 f"Status {response.status_code}: {response.text}")
    
    # Test 6: User B retweets A's tweet - should create notification for A
    response = requests.post(
        f"{BACKEND_URL}/tweets/{tweet_id}/retweet",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 200:
        # Check User A's notifications
        response = requests.get(
            f"{BACKEND_URL}/notifications",
            headers={"Authorization": f"Bearer {user_a['token']}"}
        )
        
        if response.status_code == 200:
            notifications = response.json()
            retweet_notifs = [n for n in notifications 
                             if n.get("type") == "retweet" 
                             and n.get("actor", {}).get("id") == user_b["user"]["id"]]
            
            if len(retweet_notifs) > 0:
                log_test("User B retweets A's tweet - notification created", True,
                         f"Retweet notification created with actor=User B")
            else:
                log_test("User B retweets A's tweet - notification created", False,
                         f"No retweet notification found from User B. All notifications: {notifications}")
        else:
            log_test("User B retweets A's tweet - notification created", False,
                     f"Failed to get notifications: {response.status_code}")
    else:
        log_test("User B retweets A's tweet - notification created", False,
                 f"Status {response.status_code}: {response.text}")
    
    # Test 7: Retweet non-existent tweet
    response = requests.post(
        f"{BACKEND_URL}/tweets/nonexistent123/retweet",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 404:
        log_test("Retweet non-existent tweet", True, "Returns 404")
    else:
        log_test("Retweet non-existent tweet", False,
                 f"Expected 404, got {response.status_code}: {response.text}")

def test_image_upload():
    """Test 8-10: Tweet with image upload"""
    print("\n" + "=" * 80)
    print("TEST 8-10: IMAGE UPLOAD")
    print("=" * 80)
    
    # Create a test user
    user = register_and_login_user("imageuser@example.com", "imageuser", "password123")
    if not user:
        log_test("Create user for image test", False, "Failed to register user")
        return
    log_test("Create user for image test", True, f"User created: {user['user']['username']}")
    
    # Test 8: Create tweet with small valid base64 image
    small_image = generate_small_base64_image()
    response = requests.post(
        f"{BACKEND_URL}/tweets",
        json={
            "content": "Tweet with small image",
            "image": small_image
        },
        headers={"Authorization": f"Bearer {user['token']}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("image") == small_image:
            log_test("Create tweet with small image", True, "Tweet created with image field")
            tweet_id = data["id"]
            
            # Test 9: GET tweet should return image
            response = requests.get(
                f"{BACKEND_URL}/tweets/{tweet_id}",
                headers={"Authorization": f"Bearer {user['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("image") == small_image:
                    log_test("GET tweet returns image", True, "Image field present in response")
                else:
                    log_test("GET tweet returns image", False, f"Image field missing or incorrect")
            else:
                log_test("GET tweet returns image", False,
                         f"Status {response.status_code}: {response.text}")
        else:
            log_test("Create tweet with small image", False, f"Image field missing in response: {data}")
    else:
        log_test("Create tweet with small image", False,
                 f"Status {response.status_code}: {response.text}")
    
    # Test 10: Try posting with large image (>7.5MB)
    large_image = generate_large_base64_image()
    response = requests.post(
        f"{BACKEND_URL}/tweets",
        json={
            "content": "Tweet with large image",
            "image": large_image
        },
        headers={"Authorization": f"Bearer {user['token']}"}
    )
    
    if response.status_code == 413 and "image_too_large" in response.text:
        log_test("Large image rejected (>7.5MB)", True, "Returns 413 image_too_large")
    else:
        log_test("Large image rejected (>7.5MB)", False,
                 f"Expected 413 image_too_large, got {response.status_code}: {response.text}")

def test_retweeted_field_in_feeds():
    """Test 11-13: Retweeted field in various endpoints"""
    print("\n" + "=" * 80)
    print("TEST 11-13: RETWEETED FIELD IN FEEDS")
    print("=" * 80)
    
    # Create users and tweets
    user_a = register_and_login_user("feeda@example.com", "feeda", "password123")
    user_b = register_and_login_user("feedb@example.com", "feedb", "password123")
    
    if not user_a or not user_b:
        log_test("Create users for feed test", False, "Failed to create users")
        return
    log_test("Create users for feed test", True, "Users created")
    
    # User A creates a tweet
    tweet = create_tweet(user_a["token"], "Feed test tweet")
    if not tweet:
        log_test("Create tweet for feed test", False, "Failed to create tweet")
        return
    log_test("Create tweet for feed test", True, f"Tweet created: {tweet['id']}")
    tweet_id = tweet["id"]
    
    # User B retweets it
    requests.post(
        f"{BACKEND_URL}/tweets/{tweet_id}/retweet",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    # Test 11: GET /api/tweets/feed should include retweeted field
    response = requests.get(
        f"{BACKEND_URL}/tweets/feed",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 200:
        tweets = response.json()
        if len(tweets) > 0:
            # Find our tweet
            our_tweet = next((t for t in tweets if t["id"] == tweet_id), None)
            if our_tweet:
                if "retweeted" in our_tweet and our_tweet["retweeted"] == True:
                    log_test("Feed includes retweeted field", True,
                             f"Tweet has retweeted=true for User B")
                else:
                    log_test("Feed includes retweeted field", False,
                             f"retweeted field missing or incorrect: {our_tweet}")
            else:
                log_test("Feed includes retweeted field", False, "Tweet not found in feed")
        else:
            log_test("Feed includes retweeted field", False, "No tweets in feed")
    else:
        log_test("Feed includes retweeted field", False,
                 f"Status {response.status_code}: {response.text}")
    
    # Test 12: GET /api/users/{username}/tweets should include retweeted field
    response = requests.get(
        f"{BACKEND_URL}/users/{user_a['user']['username']}/tweets",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )
    
    if response.status_code == 200:
        tweets = response.json()
        if len(tweets) > 0:
            our_tweet = next((t for t in tweets if t["id"] == tweet_id), None)
            if our_tweet:
                if "retweeted" in our_tweet and our_tweet["retweeted"] == True:
                    log_test("User tweets include retweeted field", True,
                             f"Tweet has retweeted=true for User B")
                else:
                    log_test("User tweets include retweeted field", False,
                             f"retweeted field missing or incorrect: {our_tweet}")
            else:
                log_test("User tweets include retweeted field", False, "Tweet not found")
        else:
            log_test("User tweets include retweeted field", False, "No tweets found")
    else:
        log_test("User tweets include retweeted field", False,
                 f"Status {response.status_code}: {response.text}")
    
    # Test 13: Create a reply and check GET /api/tweets/{id}/replies includes retweeted field
    reply = create_tweet(user_a["token"], "Reply to test tweet", )
    if reply:
        # Make it a reply by creating a new one with parent_id
        response = requests.post(
            f"{BACKEND_URL}/tweets",
            json={
                "content": "This is a reply",
                "parent_id": tweet_id
            },
            headers={"Authorization": f"Bearer {user_a['token']}"}
        )
        
        if response.status_code == 200:
            reply_tweet = response.json()
            reply_id = reply_tweet["id"]
            
            # User B retweets the reply
            requests.post(
                f"{BACKEND_URL}/tweets/{reply_id}/retweet",
                headers={"Authorization": f"Bearer {user_b['token']}"}
            )
            
            # Get replies
            response = requests.get(
                f"{BACKEND_URL}/tweets/{tweet_id}/replies",
                headers={"Authorization": f"Bearer {user_b['token']}"}
            )
            
            if response.status_code == 200:
                replies = response.json()
                if len(replies) > 0:
                    our_reply = next((r for r in replies if r["id"] == reply_id), None)
                    if our_reply:
                        if "retweeted" in our_reply and our_reply["retweeted"] == True:
                            log_test("Replies include retweeted field", True,
                                     f"Reply has retweeted=true for User B")
                        else:
                            log_test("Replies include retweeted field", False,
                                     f"retweeted field missing or incorrect: {our_reply}")
                    else:
                        log_test("Replies include retweeted field", False, "Reply not found")
                else:
                    log_test("Replies include retweeted field", False, "No replies found")
            else:
                log_test("Replies include retweeted field", False,
                         f"Status {response.status_code}: {response.text}")
        else:
            log_test("Replies include retweeted field", False, "Failed to create reply")
    else:
        log_test("Replies include retweeted field", False, "Failed to create initial tweet")

def main():
    print("=" * 80)
    print("BACKEND API TESTING - RETWEET AND IMAGE UPLOAD")
    print("=" * 80)
    
    try:
        # Test retweet flow
        test_retweet_flow()
        
        # Test image upload
        test_image_upload()
        
        # Test retweeted field in feeds
        test_retweeted_field_in_feeds()
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {tests_passed + tests_failed}")
    print(f"Passed: {tests_passed}")
    print(f"Failed: {tests_failed}")
    print("=" * 80)
    
    if tests_failed > 0:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()
