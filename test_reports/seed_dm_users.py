"""Create two DM test users via OTP signup against the public BASE_URL.

Reads OTP from MongoDB (db.otps.code) per project conventions.
"""
import os, time, uuid, sys, requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-feed-269.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]

def signup(name, username, email, password):
    r = requests.post(f"{BASE_URL}/api/auth/signup/start", json={
        "name": name, "username": username, "email": email, "password": password,
    }, timeout=30)
    if r.status_code == 409 and 'email_taken' in r.text:
        # already a real user, login
        r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
        r2.raise_for_status()
        return r2.json()["token"], r2.json()["user"]
    r.raise_for_status()
    # poll mongo for otp
    code = None
    for _ in range(20):
        otp = db.otps.find_one({"email": email.lower()})
        if otp and otp.get("code"):
            code = otp["code"]; break
        time.sleep(0.3)
    if not code:
        raise RuntimeError(f"OTP not found for {email}")
    r = requests.post(f"{BASE_URL}/api/auth/signup/verify", json={"email": email, "code": code}, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["token"], data["user"]

stamp = uuid.uuid4().hex[:6]
alice_email = f"test_alice_{stamp}@example.com"
bob_email = f"test_bob_{stamp}@example.com"
alice_user = f"talice{stamp}"
bob_user = f"tbob{stamp}"
PW = "TestPass123!"

a_token, a = signup("Test Alice", alice_user, alice_email, PW)
b_token, b = signup("Test Bob", bob_user, bob_email, PW)

print("ALICE_EMAIL=", alice_email)
print("ALICE_PASSWORD=", PW)
print("ALICE_USERNAME=", a["username"])
print("BOB_EMAIL=", bob_email)
print("BOB_PASSWORD=", PW)
print("BOB_USERNAME=", b["username"])
