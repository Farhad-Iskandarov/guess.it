#!/usr/bin/env python3
import requests
import time

# Test Favorites Backend Endpoints
base_url = "https://full-clone-1.preview.emergentagent.com"
session = requests.Session()
headers = {'Content-Type': 'application/json'}

print("🧪 Testing Favorites Backend Endpoints")
print("=" * 50)

# Register a test user
test_email = f"fav_test_{int(time.time())}@example.com"
test_password = "FavTest123!"

print(f"1️⃣ Registering user: {test_email}")
register_response = session.post(f"{base_url}/api/auth/register", json={
    "email": test_email,
    "password": test_password,
    "confirm_password": test_password
}, headers=headers, timeout=10)

if register_response.status_code != 200:
    print(f"❌ Registration failed: {register_response.status_code}")
    exit(1)

print("✅ User registered successfully")

# Test GET /api/favorites/clubs (should be empty)
print("2️⃣ Testing GET /api/favorites/clubs")
get_favorites_response = session.get(f"{base_url}/api/favorites/clubs", headers=headers, timeout=10)

if get_favorites_response.status_code == 200:
    data = get_favorites_response.json()
    favorites = data.get('favorites', [])
    print(f"✅ GET favorites successful: {len(favorites)} favorites found")
else:
    print(f"❌ GET favorites failed: {get_favorites_response.status_code}")
    exit(1)

# Test POST /api/favorites/clubs (add favorite)
print("3️⃣ Testing POST /api/favorites/clubs")
add_favorite_response = session.post(f"{base_url}/api/favorites/clubs", json={
    "team_id": 123,
    "team_name": "Test FC",
    "team_crest": "https://example.com/crest.png"
}, headers=headers, timeout=10)

if add_favorite_response.status_code == 200:
    print("✅ POST add favorite successful")
else:
    print(f"❌ POST add favorite failed: {add_favorite_response.status_code}")
    print(f"Response: {add_favorite_response.text}")

# Test GET again (should have 1 favorite)
print("4️⃣ Testing GET /api/favorites/clubs again")
get_favorites_response2 = session.get(f"{base_url}/api/favorites/clubs", headers=headers, timeout=10)

if get_favorites_response2.status_code == 200:
    data = get_favorites_response2.json()
    favorites = data.get('favorites', [])
    print(f"✅ GET favorites successful: {len(favorites)} favorites found")
    if len(favorites) == 1 and favorites[0]['team_id'] == 123:
        print("✅ Favorite correctly added")
    else:
        print("❌ Favorite not found correctly")
else:
    print(f"❌ GET favorites failed: {get_favorites_response2.status_code}")

# Test DELETE /api/favorites/clubs/{team_id}
print("5️⃣ Testing DELETE /api/favorites/clubs/123")
delete_favorite_response = session.delete(f"{base_url}/api/favorites/clubs/123", headers=headers, timeout=10)

if delete_favorite_response.status_code == 200:
    print("✅ DELETE favorite successful")
else:
    print(f"❌ DELETE favorite failed: {delete_favorite_response.status_code}")

# Test GET final (should be empty again)
print("6️⃣ Testing GET /api/favorites/clubs final")
get_favorites_response3 = session.get(f"{base_url}/api/favorites/clubs", headers=headers, timeout=10)

if get_favorites_response3.status_code == 200:
    data = get_favorites_response3.json()
    favorites = data.get('favorites', [])
    print(f"✅ GET favorites successful: {len(favorites)} favorites found")
    if len(favorites) == 0:
        print("✅ Favorite correctly removed")
    else:
        print("❌ Favorite not removed correctly")

print("✅ All favorites backend tests completed")
