#!/usr/bin/env python3
import requests
import time
import json

# Test Full Auth + Favorites Flow
base_url = "https://full-clone-1.preview.emergentagent.com"
session = requests.Session()
headers = {'Content-Type': 'application/json'}

print("🧪 Testing Full Auth + Favorites Flow")
print("=" * 50)

# Register a test user
test_email = f"authflow_test_{int(time.time())}@example.com"
test_password = "AuthTest123!"
test_nickname = f"testnick{int(time.time())}"

print(f"1️⃣ Registering user: {test_email}")
register_response = session.post(f"{base_url}/api/auth/register", json={
    "email": test_email,
    "password": test_password,
    "confirm_password": test_password
}, headers=headers, timeout=10)

print(f"Register status: {register_response.status_code}")
if register_response.status_code == 200:
    reg_data = register_response.json()
    print(f"Register response keys: {list(reg_data.keys())}")
    if reg_data.get('requires_nickname'):
        print(f"2️⃣ Setting nickname: {test_nickname}")
        nickname_response = session.post(f"{base_url}/api/auth/nickname", json={
            "nickname": test_nickname
        }, headers=headers, timeout=10)
        print(f"Nickname status: {nickname_response.status_code}")

# Test /api/auth/me to verify session
print("3️⃣ Testing /api/auth/me")
me_response = session.get(f"{base_url}/api/auth/me", headers=headers, timeout=10)
print(f"Auth/me status: {me_response.status_code}")
if me_response.status_code == 200:
    me_data = me_response.json()
    print(f"User authenticated: {me_data.get('email')}")
    
    # Now test favorites
    print("4️⃣ Testing favorites endpoints")
    
    # GET favorites 
    get_fav = session.get(f"{base_url}/api/favorites/clubs", headers=headers, timeout=10)
    print(f"GET favorites status: {get_fav.status_code}")
    
    if get_fav.status_code == 200:
        # POST favorite
        add_fav = session.post(f"{base_url}/api/favorites/clubs", json={
            "team_id": 999,
            "team_name": "Test Team FC", 
            "team_crest": "https://example.com/test.png"
        }, headers=headers, timeout=10)
        print(f"POST favorite status: {add_fav.status_code}")
        
        if add_fav.status_code == 200:
            # GET again to verify
            get_fav2 = session.get(f"{base_url}/api/favorites/clubs", headers=headers, timeout=10)
            if get_fav2.status_code == 200:
                fav_data = get_fav2.json()
                print(f"Favorites count after add: {len(fav_data.get('favorites', []))}")
                
                # DELETE favorite
                del_fav = session.delete(f"{base_url}/api/favorites/clubs/999", headers=headers, timeout=10)
                print(f"DELETE favorite status: {del_fav.status_code}")
                
                if del_fav.status_code == 200:
                    print("✅ ALL FAVORITES ENDPOINTS WORKING!")
                else:
                    print("❌ DELETE failed")
            else:
                print("❌ GET after add failed")
        else:
            print("❌ POST failed")
    else:
        print("❌ Initial GET failed")
else:
    print("❌ Auth verification failed")
    print(f"Response: {me_response.text}")

