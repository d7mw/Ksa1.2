#!/usr/bin/env python3
"""
Backend API Testing for ksa1 - Forgot Password Flow
Tests all forgot-password endpoints with comprehensive scenarios
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

def test_forgot_password_nonexistent_email():
    """Test 1: forgot-password/start with non-existent email should return ok"""
    print("\n=== Test 1: Forgot Password Start - Non-existent Email ===")
    
    response = requests.post(
        f"{BACKEND_URL}/auth/forgot-password/start",
        json={"email": "nonexistent@example.com"}
    )
    
    if response.status_code == 200 and response.json().get("status") == "ok":
        log_test("Forgot password start with non-existent email", True, 
                 "Returns {status: 'ok'} to avoid email enumeration")
        return True
    else:
        log_test("Forgot password start with non-existent email", False,
                 f"Expected 200 with status=ok, got {response.status_code}: {response.text}")
        return False

def register_test_user(email, username, password):
    """Helper: Register a user via signup flow"""
    print(f"\n=== Registering user: {email} ===")
    
    # Step 1: Start signup
    response = requests.post(
        f"{BACKEND_URL}/auth/signup/start",
        json={
            "name": "Test User",
            "username": username,
            "email": email,
            "password": password
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Signup start failed: {response.status_code} - {response.text}")
        return None
    
    print(f"✅ Signup started for {email}")
    
    # Step 2: Get OTP from MongoDB
    otp_record = db.otps.find_one({"email": email})
    if not otp_record:
        print(f"❌ No OTP found in MongoDB for {email}")
        return None
    
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
        return None
    
    data = response.json()
    print(f"✅ User registered successfully: {data['user']['username']}")
    return data

def test_forgot_password_registered_user():
    """Test 2-3: Register user and test forgot-password/start"""
    print("\n=== Test 2-3: Register User and Forgot Password Start ===")
    
    email = "forgottest@example.com"
    username = "forgottest"
    password = "oldpass123"
    
    # Clean up any existing user/otp/reset
    db.users.delete_many({"email": email})
    db.otps.delete_many({"email": email})
    db.password_resets.delete_many({"email": email})
    
    # Register user
    user_data = register_test_user(email, username, password)
    if not user_data:
        log_test("Register test user for forgot password", False, "Failed to register user")
        return None, None
    
    log_test("Register test user for forgot password", True, f"User {username} registered")
    
    # Test forgot-password/start
    response = requests.post(
        f"{BACKEND_URL}/auth/forgot-password/start",
        json={"email": email}
    )
    
    if response.status_code == 200 and response.json().get("status") == "ok":
        log_test("Forgot password start with registered email", True, "Returns {status: 'ok'}")
        return email, password
    else:
        log_test("Forgot password start with registered email", False,
                 f"Expected 200 with status=ok, got {response.status_code}: {response.text}")
        return None, None

def test_forgot_password_verify_flow(email, old_password):
    """Test 4-6: Verify flow with wrong/correct code"""
    print("\n=== Test 4-6: Forgot Password Verify Flow ===")
    
    # Test 4: Check MongoDB for reset code
    reset_record = db.password_resets.find_one({"email": email})
    if not reset_record:
        log_test("Check MongoDB for password reset code", False, "No reset code found in password_resets collection")
        return False
    
    correct_code = reset_record["code"]
    log_test("Check MongoDB for password reset code", True, f"Found reset code: {correct_code}")
    
    # Test 5: Verify with wrong code
    response = requests.post(
        f"{BACKEND_URL}/auth/forgot-password/verify",
        json={
            "email": email,
            "code": "000000",
            "new_password": "newpass456"
        }
    )
    
    if response.status_code == 400 and "invalid_code" in response.text:
        log_test("Forgot password verify with wrong code", True, "Returns 400 invalid_code")
    else:
        log_test("Forgot password verify with wrong code", False,
                 f"Expected 400 invalid_code, got {response.status_code}: {response.text}")
    
    # Test 6: Verify with correct code
    new_password = "newpass456"
    response = requests.post(
        f"{BACKEND_URL}/auth/forgot-password/verify",
        json={
            "email": email,
            "code": correct_code,
            "new_password": new_password
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        if "token" in data and "user" in data:
            log_test("Forgot password verify with correct code", True, 
                     "Returns token and user, password reset successful")
            return new_password
        else:
            log_test("Forgot password verify with correct code", False,
                     f"Missing token or user in response: {data}")
            return None
    else:
        log_test("Forgot password verify with correct code", False,
                 f"Expected 200, got {response.status_code}: {response.text}")
        return None

def test_login_after_reset(email, old_password, new_password):
    """Test 7-8: Login with old password (should fail) and new password (should succeed)"""
    print("\n=== Test 7-8: Login After Password Reset ===")
    
    # Test 7: Login with old password
    response = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={
            "email": email,
            "password": old_password
        }
    )
    
    if response.status_code == 401 and "invalid_credentials" in response.text:
        log_test("Login with old password after reset", True, "Returns 401 invalid_credentials")
    else:
        log_test("Login with old password after reset", False,
                 f"Expected 401 invalid_credentials, got {response.status_code}: {response.text}")
    
    # Test 8: Login with new password
    response = requests.post(
        f"{BACKEND_URL}/auth/login",
        json={
            "email": email,
            "password": new_password
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        if "token" in data:
            log_test("Login with new password after reset", True, "Returns 200 with token")
            return True
        else:
            log_test("Login with new password after reset", False, f"Missing token in response: {data}")
            return False
    else:
        log_test("Login with new password after reset", False,
                 f"Expected 200, got {response.status_code}: {response.text}")
        return False

def test_google_user_password_reset():
    """Test 9: Google user cannot reset password"""
    print("\n=== Test 9: Google User Password Reset ===")
    
    email = "googletest@example.com"
    
    # Clean up
    db.users.delete_many({"email": email})
    db.password_resets.delete_many({"email": email})
    
    # Register via Google
    response = requests.post(
        f"{BACKEND_URL}/auth/google",
        json={
            "name": "Google Test User",
            "email": email,
            "avatar": ""
        }
    )
    
    if response.status_code != 200:
        log_test("Register Google user", False, f"Failed to register: {response.status_code} - {response.text}")
        return False
    
    log_test("Register Google user", True, "Google user registered successfully")
    
    # Try forgot-password/start
    response = requests.post(
        f"{BACKEND_URL}/auth/forgot-password/start",
        json={"email": email}
    )
    
    if response.status_code != 200 or response.json().get("status") != "ok":
        log_test("Forgot password start for Google user", False,
                 f"Expected 200 with status=ok, got {response.status_code}: {response.text}")
        return False
    
    # Check that NO reset code was created
    reset_record = db.password_resets.find_one({"email": email})
    if reset_record:
        log_test("Google user password reset prevention", False,
                 "Reset code was created for Google user (should not happen)")
        return False
    else:
        log_test("Google user password reset prevention", True,
                 "No reset code created for Google user, returns ok to avoid enumeration")
        return True

def test_attempts_limit():
    """Test 10: Test 5 wrong attempts, 6th should return 429"""
    print("\n=== Test 10: Password Reset Attempts Limit ===")
    
    email = "attemptstest@example.com"
    username = "attemptstest"
    password = "testpass123"
    
    # Clean up
    db.users.delete_many({"email": email})
    db.otps.delete_many({"email": email})
    db.password_resets.delete_many({"email": email})
    
    # Register user
    user_data = register_test_user(email, username, password)
    if not user_data:
        log_test("Register user for attempts limit test", False, "Failed to register user")
        return False
    
    log_test("Register user for attempts limit test", True, f"User {username} registered")
    
    # Request password reset
    response = requests.post(
        f"{BACKEND_URL}/auth/forgot-password/start",
        json={"email": email}
    )
    
    if response.status_code != 200:
        log_test("Request password reset for attempts test", False,
                 f"Failed to start reset: {response.status_code} - {response.text}")
        return False
    
    # Make 5 wrong attempts
    for i in range(1, 6):
        response = requests.post(
            f"{BACKEND_URL}/auth/forgot-password/verify",
            json={
                "email": email,
                "code": "000000",
                "new_password": "newpass123"
            }
        )
        print(f"  Attempt {i}: {response.status_code} - {response.json().get('detail', 'N/A')}")
    
    # 6th attempt should return 429
    response = requests.post(
        f"{BACKEND_URL}/auth/forgot-password/verify",
        json={
            "email": email,
            "code": "000000",
            "new_password": "newpass123"
        }
    )
    
    if response.status_code == 429 and "too_many_attempts" in response.text:
        log_test("Password reset attempts limit", True, "6th attempt returns 429 too_many_attempts")
        return True
    else:
        log_test("Password reset attempts limit", False,
                 f"Expected 429 too_many_attempts, got {response.status_code}: {response.text}")
        return False

def main():
    print("=" * 80)
    print("BACKEND API TESTING - FORGOT PASSWORD FLOW")
    print("=" * 80)
    
    try:
        # Test 1: Non-existent email
        test_forgot_password_nonexistent_email()
        
        # Test 2-3: Register user and forgot-password/start
        email, old_password = test_forgot_password_registered_user()
        
        if email and old_password:
            # Test 4-6: Verify flow
            new_password = test_forgot_password_verify_flow(email, old_password)
            
            if new_password:
                # Test 7-8: Login after reset
                test_login_after_reset(email, old_password, new_password)
        
        # Test 9: Google user
        test_google_user_password_reset()
        
        # Test 10: Attempts limit
        test_attempts_limit()
        
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
