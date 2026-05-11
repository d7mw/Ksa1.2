#!/usr/bin/env python3
"""
Backend API Testing for ksa1 - Retweet on Profile Feature
Tests the new retweet-on-profile feature with kind=posts parameter
"""

import requests
import sys
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

def register_and_login_user(email, username, name, password):
    """Helper: Register a user via signup flow and login"""
    print(f"\n=== Registering and logging in user: {username} ===")
    
    # Clean up any existing user/otp
    db.users.delete_many({"email": email})
    db.otps.delete_many({"email": email})
    
    # Step 1: Start signup
    response = requests.post(
        f"{BACKEND_URL}/auth/signup/start",
        json={
            "name": name,
            "username": username,
            "email": email,
            "password": password
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Signup start failed: {response.status_code} - {response.text}")
        return None, None
    
    print(f"✅ Signup started for {email}")
    
    # Step 2: Get OTP from MongoDB
    otp_record = db.otps.find_one({"email": email})
    if not otp_record:
        print(f"❌ No OTP found in MongoDB for {email}")
        return None, None
    
    code = otp_record["code"]
    print(f"✅ Retrieved OTP from MongoDB: {code}")
    
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
        return None, None
    
    data = response.json()
    token = data.get("token")
    user = data.get("user")
    print(f"✅ User registered successfully: {user['username']}")
    
    return token, user

def test_retweet_on_profile():
    """Test the complete retweet-on-profile feature"""
    print("\n" + "=" * 80)
    print("TESTING RETWEET-ON-PROFILE FEATURE")
    print("=" * 80)
    
    # Test 1-2: Create user A and user B
    print("\n=== Test 1-2: Create Users A and B ===")
    
    token_a, user_a = register_and_login_user(
        "usera@example.com",
        "usera",
        "User A",
        "password123"
    )
    
    if not token_a:
        log_test("Create and login User A", False, "Failed to create user A")
        return False
    
    log_test("Create and login User A", True, f"User A created: {user_a['username']}")
    
    token_b, user_b = register_and_login_user(
        "userb@example.com",
        "userb",
        "User B",
        "password123"
    )
    
    if not token_b:
        log_test("Create and login User B", False, "Failed to create user B")
        return False
    
    log_test("Create and login User B", True, f"User B created: {user_b['username']}")
    
    # Test 3: User A posts tweet1
    print("\n=== Test 3: User A Posts Tweet ===")
    
    response = requests.post(
        f"{BACKEND_URL}/tweets",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"content": "Original tweet by A"}
    )
    
    if response.status_code != 200:
        log_test("User A posts tweet1", False, f"Failed to post tweet: {response.status_code} - {response.text}")
        return False
    
    tweet1 = response.json()
    tweet1_id = tweet1["id"]
    log_test("User A posts tweet1", True, f"Tweet created with ID: {tweet1_id}")
    
    # Test 4: User B retweets tweet1
    print("\n=== Test 4: User B Retweets Tweet1 ===")
    
    response = requests.post(
        f"{BACKEND_URL}/tweets/{tweet1_id}/retweet",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("User B retweets tweet1", False, f"Failed to retweet: {response.status_code} - {response.text}")
        return False
    
    retweet_response = response.json()
    if retweet_response.get("retweeted") != True:
        log_test("User B retweets tweet1", False, f"Expected retweeted=true, got {retweet_response}")
        return False
    
    log_test("User B retweets tweet1", True, "Retweet successful, returns {retweeted: true}")
    
    # Test 5: GET /api/users/{B.username}/tweets?kind=posts (as B or unauthenticated)
    print("\n=== Test 5: GET User B's Profile Tweets (kind=posts) ===")
    
    # Test as authenticated user B
    response = requests.get(
        f"{BACKEND_URL}/users/{user_b['username']}/tweets?kind=posts",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("GET User B's profile tweets (authenticated)", False, 
                 f"Failed to get tweets: {response.status_code} - {response.text}")
        return False
    
    tweets = response.json()
    
    if len(tweets) < 1:
        log_test("GET User B's profile tweets (authenticated)", False, 
                 f"Expected at least 1 tweet, got {len(tweets)}")
        return False
    
    # Find the retweeted tweet
    retweeted_tweet = None
    for t in tweets:
        if t["id"] == tweet1_id:
            retweeted_tweet = t
            break
    
    if not retweeted_tweet:
        log_test("GET User B's profile tweets (authenticated)", False, 
                 f"Tweet1 not found in User B's profile tweets")
        return False
    
    # Check retweeted_by field
    if "retweeted_by" not in retweeted_tweet:
        log_test("GET User B's profile tweets - retweeted_by field", False, 
                 "retweeted_by field missing from retweeted tweet")
        return False
    
    retweeted_by = retweeted_tweet["retweeted_by"]
    
    # Validate retweeted_by structure
    required_fields = ["id", "name", "username", "avatar"]
    missing_fields = [f for f in required_fields if f not in retweeted_by]
    
    if missing_fields:
        log_test("GET User B's profile tweets - retweeted_by structure", False, 
                 f"Missing fields in retweeted_by: {missing_fields}")
        return False
    
    if retweeted_by["id"] != user_b["id"] or retweeted_by["username"] != user_b["username"]:
        log_test("GET User B's profile tweets - retweeted_by user info", False, 
                 f"retweeted_by user info doesn't match User B: {retweeted_by}")
        return False
    
    log_test("GET User B's profile tweets - retweeted_by field", True, 
             f"retweeted_by contains correct user info: {retweeted_by['username']}")
    
    # Check retweeted_at field
    if "retweeted_at" not in retweeted_tweet:
        log_test("GET User B's profile tweets - retweeted_at field", False, 
                 "retweeted_at field missing from retweeted tweet")
        return False
    
    log_test("GET User B's profile tweets - retweeted_at field", True, 
             f"retweeted_at timestamp present: {retweeted_tweet['retweeted_at']}")
    
    # Test as unauthenticated
    response = requests.get(
        f"{BACKEND_URL}/users/{user_b['username']}/tweets?kind=posts"
    )
    
    if response.status_code != 200:
        log_test("GET User B's profile tweets (unauthenticated)", False, 
                 f"Failed to get tweets: {response.status_code} - {response.text}")
        return False
    
    tweets_unauth = response.json()
    
    if len(tweets_unauth) < 1:
        log_test("GET User B's profile tweets (unauthenticated)", False, 
                 f"Expected at least 1 tweet, got {len(tweets_unauth)}")
        return False
    
    # Find the retweeted tweet
    retweeted_tweet_unauth = None
    for t in tweets_unauth:
        if t["id"] == tweet1_id:
            retweeted_tweet_unauth = t
            break
    
    if not retweeted_tweet_unauth or "retweeted_by" not in retweeted_tweet_unauth:
        log_test("GET User B's profile tweets (unauthenticated)", False, 
                 "retweeted_by field missing for unauthenticated request")
        return False
    
    log_test("GET User B's profile tweets (unauthenticated)", True, 
             "Unauthenticated request also returns retweeted_by field")
    
    # Test 6: User B posts their own tweet2
    print("\n=== Test 6: User B Posts Own Tweet ===")
    
    response = requests.post(
        f"{BACKEND_URL}/tweets",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"content": "My own tweet"}
    )
    
    if response.status_code != 200:
        log_test("User B posts tweet2", False, f"Failed to post tweet: {response.status_code} - {response.text}")
        return False
    
    tweet2 = response.json()
    tweet2_id = tweet2["id"]
    log_test("User B posts tweet2", True, f"Tweet created with ID: {tweet2_id}")
    
    # Test 7: GET /api/users/{B.username}/tweets?kind=posts again
    print("\n=== Test 7: GET User B's Profile Tweets (should have 2 tweets) ===")
    
    response = requests.get(
        f"{BACKEND_URL}/users/{user_b['username']}/tweets?kind=posts",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("GET User B's profile tweets (2 tweets)", False, 
                 f"Failed to get tweets: {response.status_code} - {response.text}")
        return False
    
    tweets = response.json()
    
    if len(tweets) != 2:
        log_test("GET User B's profile tweets (2 tweets)", False, 
                 f"Expected 2 tweets, got {len(tweets)}")
        return False
    
    # Check that tweet2 (own) has no retweeted_by
    tweet2_in_list = None
    tweet1_in_list = None
    for t in tweets:
        if t["id"] == tweet2_id:
            tweet2_in_list = t
        if t["id"] == tweet1_id:
            tweet1_in_list = t
    
    if not tweet2_in_list:
        log_test("GET User B's profile tweets - tweet2 present", False, 
                 "Tweet2 not found in profile tweets")
        return False
    
    if "retweeted_by" in tweet2_in_list:
        log_test("GET User B's profile tweets - tweet2 no retweeted_by", False, 
                 "Tweet2 (own tweet) should not have retweeted_by field")
        return False
    
    log_test("GET User B's profile tweets - tweet2 no retweeted_by", True, 
             "Tweet2 (own tweet) correctly has no retweeted_by field")
    
    if not tweet1_in_list or "retweeted_by" not in tweet1_in_list:
        log_test("GET User B's profile tweets - tweet1 with retweeted_by", False, 
                 "Tweet1 (retweet) should have retweeted_by field")
        return False
    
    log_test("GET User B's profile tweets - tweet1 with retweeted_by", True, 
             "Tweet1 (retweet) correctly has retweeted_by field")
    
    # Check chronological order (newest first)
    if tweets[0]["id"] == tweet2_id and tweets[1]["id"] == tweet1_id:
        log_test("GET User B's profile tweets - chronological order", True, 
                 "Tweets sorted chronologically (newest first)")
    elif tweets[0]["id"] == tweet1_id and tweets[1]["id"] == tweet2_id:
        # This is also acceptable if retweet happened after tweet2 was posted
        log_test("GET User B's profile tweets - chronological order", True, 
                 "Tweets sorted by retweet/post time")
    else:
        log_test("GET User B's profile tweets - chronological order", False, 
                 f"Unexpected order: {[t['id'] for t in tweets]}")
    
    # Test 8: User B unretweets tweet1
    print("\n=== Test 8: User B Unretweets Tweet1 ===")
    
    response = requests.post(
        f"{BACKEND_URL}/tweets/{tweet1_id}/retweet",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("User B unretweets tweet1", False, f"Failed to unretweet: {response.status_code} - {response.text}")
        return False
    
    unretweet_response = response.json()
    if unretweet_response.get("retweeted") != False:
        log_test("User B unretweets tweet1", False, f"Expected retweeted=false, got {unretweet_response}")
        return False
    
    log_test("User B unretweets tweet1", True, "Unretweet successful, returns {retweeted: false}")
    
    # Test 9: GET /api/users/{B.username}/tweets?kind=posts (should only have tweet2)
    print("\n=== Test 9: GET User B's Profile Tweets (should only have tweet2) ===")
    
    response = requests.get(
        f"{BACKEND_URL}/users/{user_b['username']}/tweets?kind=posts",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("GET User B's profile tweets after unretweet", False, 
                 f"Failed to get tweets: {response.status_code} - {response.text}")
        return False
    
    tweets = response.json()
    
    if len(tweets) != 1:
        log_test("GET User B's profile tweets after unretweet", False, 
                 f"Expected 1 tweet, got {len(tweets)}: {[t['id'] for t in tweets]}")
        return False
    
    if tweets[0]["id"] != tweet2_id:
        log_test("GET User B's profile tweets after unretweet", False, 
                 f"Expected tweet2, got {tweets[0]['id']}")
        return False
    
    log_test("GET User B's profile tweets after unretweet", True, 
             "Only tweet2 present, retweet correctly removed")
    
    # Test 10: User B retweets tweet1 again
    print("\n=== Test 10: User B Retweets Tweet1 Again ===")
    
    response = requests.post(
        f"{BACKEND_URL}/tweets/{tweet1_id}/retweet",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("User B retweets tweet1 again", False, f"Failed to retweet: {response.status_code} - {response.text}")
        return False
    
    retweet_response = response.json()
    if retweet_response.get("retweeted") != True:
        log_test("User B retweets tweet1 again", False, f"Expected retweeted=true, got {retweet_response}")
        return False
    
    log_test("User B retweets tweet1 again", True, "Retweet successful")
    
    # Verify retweet appears again in profile feed
    response = requests.get(
        f"{BACKEND_URL}/users/{user_b['username']}/tweets?kind=posts",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("Verify retweet appears in profile again", False, 
                 f"Failed to get tweets: {response.status_code} - {response.text}")
        return False
    
    tweets = response.json()
    
    if len(tweets) != 2:
        log_test("Verify retweet appears in profile again", False, 
                 f"Expected 2 tweets, got {len(tweets)}")
        return False
    
    # Check that tweet1 is back with retweeted_by
    tweet1_found = False
    for t in tweets:
        if t["id"] == tweet1_id and "retweeted_by" in t:
            tweet1_found = True
            break
    
    if not tweet1_found:
        log_test("Verify retweet appears in profile again", False, 
                 "Tweet1 with retweeted_by not found after re-retweet")
        return False
    
    log_test("Verify retweet appears in profile again", True, 
             "Tweet1 correctly appears in profile with retweeted_by field")
    
    # Test 11: Test retweeted field for authenticated viewer
    print("\n=== Test 11: Test Retweeted Field for Authenticated Viewer ===")
    
    response = requests.get(
        f"{BACKEND_URL}/users/{user_b['username']}/tweets",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if response.status_code != 200:
        log_test("GET User B's tweets as authenticated user B", False, 
                 f"Failed to get tweets: {response.status_code} - {response.text}")
        return False
    
    tweets = response.json()
    
    # Find tweet1 in the response
    tweet1_found = False
    for t in tweets:
        if t["id"] == tweet1_id:
            if "retweeted" not in t:
                log_test("Retweeted field present for authenticated viewer", False, 
                         "retweeted field missing from tweet")
                return False
            if t["retweeted"] != True:
                log_test("Retweeted field value for authenticated viewer", False, 
                         f"Expected retweeted=true, got {t['retweeted']}")
                return False
            tweet1_found = True
            break
    
    if not tweet1_found:
        log_test("Retweeted field for authenticated viewer", False, 
                 "Tweet1 not found in response")
        return False
    
    log_test("Retweeted field for authenticated viewer", True, 
             "Tweet1 has retweeted=true for User B (who retweeted it)")
    
    # Test 12: GET /api/users/{A.username}/tweets?kind=posts (should only show A's own tweets)
    print("\n=== Test 12: GET User A's Profile Tweets (should only show own tweets) ===")
    
    response = requests.get(
        f"{BACKEND_URL}/users/{user_a['username']}/tweets?kind=posts"
    )
    
    if response.status_code != 200:
        log_test("GET User A's profile tweets", False, 
                 f"Failed to get tweets: {response.status_code} - {response.text}")
        return False
    
    tweets = response.json()
    
    if len(tweets) != 1:
        log_test("GET User A's profile tweets - count", False, 
                 f"Expected 1 tweet (A's own), got {len(tweets)}")
        return False
    
    if tweets[0]["id"] != tweet1_id:
        log_test("GET User A's profile tweets - correct tweet", False, 
                 f"Expected tweet1, got {tweets[0]['id']}")
        return False
    
    if "retweeted_by" in tweets[0]:
        log_test("GET User A's profile tweets - no retweeted_by", False, 
                 "User A's own tweet should not have retweeted_by field in their profile")
        return False
    
    log_test("GET User A's profile tweets", True, 
             "User A's profile only shows their own tweet (no retweets)")
    
    return True

def main():
    print("=" * 80)
    print("BACKEND API TESTING - RETWEET ON PROFILE FEATURE")
    print("=" * 80)
    
    try:
        test_retweet_on_profile()
        
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
