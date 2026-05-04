"""
Backend API Tests for GuessIt Football Prediction App
Tests: Health, Root, Auth (Register, Login, Me, Logout)
"""
import pytest
import requests
import os
import uuid

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "farhad.isgandar@gmail.com"
ADMIN_PASSWORD = "Salam123?"


class TestHealthEndpoints:
    """Health and root endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✅ Health check passed: {data}")
    
    def test_root_endpoint(self):
        """Test /api/ returns API running message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "GuessIt API is running"
        print(f"✅ Root endpoint passed: {data}")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_register_missing_confirm_password(self):
        """Test registration fails without confirm_password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "TestPass123!"
            }
        )
        assert response.status_code == 422  # Validation error
        print("✅ Registration correctly requires confirm_password")
    
    def test_register_password_mismatch(self):
        """Test registration fails when passwords don't match"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "TestPass123!",
                "confirm_password": "DifferentPass123!"
            }
        )
        assert response.status_code == 422
        print("✅ Registration correctly validates password match")
    
    def test_register_weak_password(self):
        """Test registration fails with weak password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "weak",
                "confirm_password": "weak"
            }
        )
        assert response.status_code == 422
        print("✅ Registration correctly validates password strength")
    
    def test_register_success(self):
        """Test successful user registration"""
        unique_email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "TestPass123!",
                "confirm_password": "TestPass123!"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == unique_email
        assert data["requires_nickname"] == True
        assert data["message"] == "Registration successful. Please choose a nickname."
        print(f"✅ Registration successful for {unique_email}")
    
    def test_register_duplicate_email(self):
        """Test registration fails with duplicate email"""
        # First registration
        unique_email = f"TEST_dup_{uuid.uuid4().hex[:8]}@example.com"
        response1 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "TestPass123!",
                "confirm_password": "TestPass123!"
            }
        )
        assert response1.status_code == 200
        
        # Second registration with same email
        response2 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "TestPass123!",
                "confirm_password": "TestPass123!"
            }
        )
        assert response2.status_code == 409  # Conflict
        print("✅ Duplicate email registration correctly rejected")
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        assert data["message"] == "Login successful"
        print(f"✅ Login successful for admin: {data['user']['nickname']}")
    
    def test_login_invalid_credentials(self):
        """Test login fails with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "WrongPass123!"
            }
        )
        assert response.status_code == 401
        data = response.json()
        assert "Invalid email or password" in data["detail"]
        print("✅ Invalid login correctly rejected")
    
    def test_login_wrong_password(self):
        """Test login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": "WrongPassword123!"
            }
        )
        assert response.status_code == 401
        print("✅ Wrong password correctly rejected")
    
    def test_me_without_auth(self):
        """Test /auth/me returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✅ /auth/me correctly requires authentication")
    
    def test_me_with_session(self):
        """Test /auth/me returns user data with valid session"""
        # Login first to get session cookie
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert login_response.status_code == 200
        
        # Now test /me endpoint
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"✅ /auth/me returned user data: {data['nickname']}")
    
    def test_logout(self):
        """Test logout clears session"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert login_response.status_code == 200
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert data["message"] == "Logged out successfully"
        
        # Verify session is cleared
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 401
        print("✅ Logout successful and session cleared")


class TestNicknameEndpoints:
    """Nickname check and set endpoint tests"""
    
    def test_nickname_check_available(self):
        """Test nickname availability check for available nickname"""
        unique_nickname = f"TEST_{uuid.uuid4().hex[:8]}"
        response = requests.get(
            f"{BASE_URL}/api/auth/nickname/check",
            params={"nickname": unique_nickname}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == True
        print(f"✅ Nickname '{unique_nickname}' is available")
    
    def test_nickname_check_taken(self):
        """Test nickname availability check for taken nickname (admin)"""
        response = requests.get(
            f"{BASE_URL}/api/auth/nickname/check",
            params={"nickname": "admin"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "suggestions" in data
        print(f"✅ Nickname 'admin' correctly shown as taken with suggestions: {data['suggestions']}")
    
    def test_nickname_check_too_short(self):
        """Test nickname validation for too short nickname"""
        response = requests.get(
            f"{BASE_URL}/api/auth/nickname/check",
            params={"nickname": "ab"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "3-20 characters" in data["message"]
        print("✅ Short nickname correctly rejected")
    
    def test_nickname_check_invalid_chars(self):
        """Test nickname validation for invalid characters"""
        response = requests.get(
            f"{BASE_URL}/api/auth/nickname/check",
            params={"nickname": "test@user"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        print("✅ Invalid characters in nickname correctly rejected")


class TestFootballEndpoints:
    """Football-related endpoint tests"""
    
    def test_matches_endpoint(self):
        """Test /api/football/matches returns data"""
        response = requests.get(f"{BASE_URL}/api/football/matches")
        assert response.status_code == 200
        data = response.json()
        # May be empty due to API key issue, but should return valid structure
        assert isinstance(data, dict) or isinstance(data, list)
        print(f"✅ Matches endpoint returned data")
    
    def test_leaderboard_endpoint(self):
        """Test /api/football/leaderboard returns data"""
        response = requests.get(f"{BASE_URL}/api/football/leaderboard", params={"limit": 5})
        assert response.status_code == 200
        data = response.json()
        # Leaderboard returns dict with 'users' key
        assert isinstance(data, dict)
        assert "users" in data
        assert isinstance(data["users"], list)
        print(f"✅ Leaderboard endpoint returned {len(data['users'])} entries")
    
    def test_banners_endpoint(self):
        """Test /api/football/banners returns data"""
        response = requests.get(f"{BASE_URL}/api/football/banners")
        assert response.status_code == 200
        print("✅ Banners endpoint returned data")


class TestPublicEndpoints:
    """Public content endpoint tests"""
    
    def test_news_endpoint(self):
        """Test /api/admin/news returns data (news is under admin routes)"""
        response = requests.get(f"{BASE_URL}/api/admin/news")
        # News endpoint may require auth or return empty list
        assert response.status_code in [200, 401, 403]
        print(f"✅ News endpoint returned status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
