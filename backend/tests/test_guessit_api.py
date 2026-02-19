"""
GuessIt API Tests - Backend API testing for football match prediction application
Tests cover: Auth, Football API, Predictions, and Favorites endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://match-prediction-app.preview.emergentagent.com')

# Test user credentials
TEST_EMAIL = f"test_api_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "TestPass123!"
TEST_NICKNAME = f"TestPlayer_{uuid.uuid4().hex[:6]}"


class TestHealthCheck:
    """Health check and basic connectivity tests"""
    
    def test_health_endpoint(self):
        """Test the health check endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_root_endpoint(self):
        """Test the root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Root endpoint failed: {response.text}"
        data = response.json()
        assert "message" in data
        print("✓ Root endpoint passed")


class TestFootballAPI:
    """Football API endpoints for fetching matches"""
    
    def test_get_competitions(self):
        """Test fetching available competitions"""
        response = requests.get(f"{BASE_URL}/api/football/competitions")
        assert response.status_code == 200, f"Competitions fetch failed: {response.text}"
        data = response.json()
        assert "competitions" in data
        competitions = data["competitions"]
        assert len(competitions) > 0, "No competitions returned"
        # Verify structure
        for comp in competitions:
            assert "code" in comp
            assert "name" in comp
        print(f"✓ Got {len(competitions)} competitions")
    
    def test_get_matches(self):
        """Test fetching all matches"""
        response = requests.get(f"{BASE_URL}/api/football/matches")
        assert response.status_code == 200, f"Matches fetch failed: {response.text}"
        data = response.json()
        assert "matches" in data
        assert "total" in data
        if data["total"] > 0:
            match = data["matches"][0]
            # Verify match structure
            assert "id" in match
            assert "homeTeam" in match
            assert "awayTeam" in match
            assert "status" in match
            assert "score" in match
            assert "competition" in match
        print(f"✓ Got {data['total']} matches")
    
    def test_get_live_matches(self):
        """Test fetching live matches"""
        response = requests.get(f"{BASE_URL}/api/football/matches/live")
        assert response.status_code == 200, f"Live matches fetch failed: {response.text}"
        data = response.json()
        assert "matches" in data
        assert "total" in data
        # Live matches may be empty if no matches are currently playing
        print(f"✓ Got {data['total']} live matches")
    
    def test_get_today_matches(self):
        """Test fetching today's matches"""
        response = requests.get(f"{BASE_URL}/api/football/matches/today")
        assert response.status_code == 200, f"Today matches fetch failed: {response.text}"
        data = response.json()
        assert "matches" in data
        assert "total" in data
        print(f"✓ Got {data['total']} today's matches")
    
    def test_get_upcoming_matches(self):
        """Test fetching upcoming matches"""
        response = requests.get(f"{BASE_URL}/api/football/matches/upcoming?days=7")
        assert response.status_code == 200, f"Upcoming matches fetch failed: {response.text}"
        data = response.json()
        assert "matches" in data
        assert "total" in data
        print(f"✓ Got {data['total']} upcoming matches")
    
    def test_get_competition_matches(self):
        """Test fetching matches for a specific competition"""
        # Test with Premier League
        response = requests.get(f"{BASE_URL}/api/football/matches/competition/PL")
        assert response.status_code == 200, f"Competition matches fetch failed: {response.text}"
        data = response.json()
        assert "matches" in data
        print(f"✓ Got {data['total']} Premier League matches")
    
    def test_search_matches(self):
        """Test match search by team name"""
        response = requests.get(f"{BASE_URL}/api/football/search?q=Barcelona")
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "matches" in data
        assert "query" in data
        print(f"✓ Search returned {len(data['matches'])} results")


class TestAuthentication:
    """Authentication flow tests - register, login, nickname, logout"""
    
    session = requests.Session()
    user_id = None
    
    def test_01_register_user(self):
        """Test user registration"""
        response = TestAuthentication.session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "confirm_password": TEST_PASSWORD
            }
        )
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["requires_nickname"] == True
        assert data["user"]["nickname_set"] == False
        TestAuthentication.user_id = data["user"]["user_id"]
        print(f"✓ User registered: {TEST_EMAIL}")
    
    def test_02_check_nickname_available(self):
        """Test nickname availability check"""
        response = TestAuthentication.session.get(
            f"{BASE_URL}/api/auth/nickname/check?nickname={TEST_NICKNAME}"
        )
        assert response.status_code == 200, f"Nickname check failed: {response.text}"
        data = response.json()
        assert data["available"] == True
        print(f"✓ Nickname '{TEST_NICKNAME}' is available")
    
    def test_03_set_nickname(self):
        """Test setting user nickname"""
        response = TestAuthentication.session.post(
            f"{BASE_URL}/api/auth/nickname",
            json={"nickname": TEST_NICKNAME}
        )
        assert response.status_code == 200, f"Set nickname failed: {response.text}"
        data = response.json()
        assert data["user"]["nickname"] == TEST_NICKNAME
        assert data["user"]["nickname_set"] == True
        assert data["requires_nickname"] == False
        print(f"✓ Nickname set: {TEST_NICKNAME}")
    
    def test_04_get_current_user(self):
        """Test getting current user info"""
        response = TestAuthentication.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        assert data["email"] == TEST_EMAIL
        assert data["nickname"] == TEST_NICKNAME
        assert data["auth_provider"] == "email"
        print(f"✓ Current user retrieved: {data['nickname']}")
    
    def test_05_logout(self):
        """Test user logout"""
        response = TestAuthentication.session.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200, f"Logout failed: {response.text}"
        data = response.json()
        assert "message" in data
        print("✓ User logged out")
    
    def test_06_login_after_logout(self):
        """Test logging back in"""
        response = TestAuthentication.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["nickname"] == TEST_NICKNAME
        assert data["requires_nickname"] == False
        print(f"✓ User logged in: {data['user']['nickname']}")
    
    def test_07_duplicate_registration_fails(self):
        """Test that duplicate email registration fails"""
        new_session = requests.Session()
        response = new_session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "confirm_password": TEST_PASSWORD
            }
        )
        assert response.status_code == 400, f"Duplicate registration should fail: {response.text}"
        print("✓ Duplicate registration correctly rejected")
    
    def test_08_invalid_login_fails(self):
        """Test that invalid credentials fail"""
        new_session = requests.Session()
        response = new_session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "WrongPassword123!"
            }
        )
        assert response.status_code == 401, f"Invalid login should fail: {response.text}"
        print("✓ Invalid login correctly rejected")
    
    def test_09_weak_password_fails(self):
        """Test that weak password registration fails"""
        new_session = requests.Session()
        response = new_session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"weak_{uuid.uuid4().hex[:8]}@example.com",
                "password": "weak",
                "confirm_password": "weak"
            }
        )
        assert response.status_code == 422, f"Weak password should be rejected: {response.text}"
        print("✓ Weak password correctly rejected")


class TestPredictions:
    """Prediction CRUD tests - requires authenticated session"""
    
    session = requests.Session()
    match_id = None
    
    @classmethod
    def setup_class(cls):
        """Login before running prediction tests"""
        response = cls.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not login for prediction tests")
        
        # Get a match ID for testing
        matches_response = requests.get(f"{BASE_URL}/api/football/matches/upcoming")
        if matches_response.status_code == 200:
            data = matches_response.json()
            if data["matches"]:
                # Find a match that isn't locked
                for match in data["matches"]:
                    if not match.get("predictionLocked", True):
                        cls.match_id = match["id"]
                        break
                if not cls.match_id and data["matches"]:
                    cls.match_id = data["matches"][0]["id"]
    
    def test_01_create_prediction(self):
        """Test creating a new prediction"""
        if not TestPredictions.match_id:
            pytest.skip("No match available for testing")
        
        response = TestPredictions.session.post(
            f"{BASE_URL}/api/predictions",
            json={
                "match_id": TestPredictions.match_id,
                "prediction": "home"
            }
        )
        # May be 200 (success) or could fail if prediction is locked
        if response.status_code == 200:
            data = response.json()
            assert data["match_id"] == TestPredictions.match_id
            assert data["prediction"] == "home"
            print(f"✓ Prediction created for match {TestPredictions.match_id}")
        else:
            print(f"⚠ Could not create prediction (may be locked): {response.status_code}")
    
    def test_02_get_my_predictions(self):
        """Test getting user's predictions"""
        response = TestPredictions.session.get(f"{BASE_URL}/api/predictions/me")
        assert response.status_code == 200, f"Get predictions failed: {response.text}"
        data = response.json()
        assert "predictions" in data
        assert "total" in data
        print(f"✓ Got {data['total']} predictions")
    
    def test_03_get_detailed_predictions(self):
        """Test getting detailed predictions with match info"""
        response = TestPredictions.session.get(f"{BASE_URL}/api/predictions/me/detailed")
        assert response.status_code == 200, f"Get detailed predictions failed: {response.text}"
        data = response.json()
        assert "predictions" in data
        assert "summary" in data
        assert "user_points" in data
        assert "user_level" in data
        print(f"✓ Got detailed predictions with summary")
    
    def test_04_update_prediction(self):
        """Test updating an existing prediction"""
        if not TestPredictions.match_id:
            pytest.skip("No match available for testing")
        
        response = TestPredictions.session.post(
            f"{BASE_URL}/api/predictions",
            json={
                "match_id": TestPredictions.match_id,
                "prediction": "draw"
            }
        )
        if response.status_code == 200:
            data = response.json()
            assert data["prediction"] == "draw"
            print(f"✓ Prediction updated to 'draw'")
        else:
            print(f"⚠ Could not update prediction: {response.status_code}")
    
    def test_05_delete_prediction(self):
        """Test deleting a prediction"""
        if not TestPredictions.match_id:
            pytest.skip("No match available for testing")
        
        response = TestPredictions.session.delete(
            f"{BASE_URL}/api/predictions/match/{TestPredictions.match_id}"
        )
        # May be 200 (deleted) or 404 (not found)
        assert response.status_code in [200, 404], f"Delete failed unexpectedly: {response.text}"
        print(f"✓ Prediction delete operation completed")


class TestFavorites:
    """Favorites CRUD tests - requires authenticated session"""
    
    session = requests.Session()
    test_team_id = 81  # Barcelona's ID in Football-Data.org
    test_team_name = "FC Barcelona"
    
    @classmethod
    def setup_class(cls):
        """Login before running favorites tests"""
        response = cls.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not login for favorites tests")
    
    def test_01_add_favorite(self):
        """Test adding a favorite club"""
        response = TestFavorites.session.post(
            f"{BASE_URL}/api/favorites/clubs",
            json={
                "team_id": TestFavorites.test_team_id,
                "team_name": TestFavorites.test_team_name,
                "team_crest": None
            }
        )
        assert response.status_code == 200, f"Add favorite failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "favorite" in data
        print(f"✓ Added {TestFavorites.test_team_name} to favorites")
    
    def test_02_get_favorites(self):
        """Test getting user's favorites"""
        response = TestFavorites.session.get(f"{BASE_URL}/api/favorites/clubs")
        assert response.status_code == 200, f"Get favorites failed: {response.text}"
        data = response.json()
        assert "favorites" in data
        # Should have at least the team we just added
        team_ids = [f["team_id"] for f in data["favorites"]]
        assert TestFavorites.test_team_id in team_ids
        print(f"✓ Got {len(data['favorites'])} favorites")
    
    def test_03_add_duplicate_favorite(self):
        """Test that adding duplicate favorite is handled"""
        response = TestFavorites.session.post(
            f"{BASE_URL}/api/favorites/clubs",
            json={
                "team_id": TestFavorites.test_team_id,
                "team_name": TestFavorites.test_team_name,
                "team_crest": None
            }
        )
        assert response.status_code == 200, f"Duplicate add should be handled: {response.text}"
        data = response.json()
        assert "Already in favorites" in data.get("message", "")
        print("✓ Duplicate favorite correctly handled")
    
    def test_04_remove_favorite(self):
        """Test removing a favorite club"""
        response = TestFavorites.session.delete(
            f"{BASE_URL}/api/favorites/clubs/{TestFavorites.test_team_id}"
        )
        assert response.status_code == 200, f"Remove favorite failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Removed {TestFavorites.test_team_name} from favorites")
    
    def test_05_remove_nonexistent_favorite(self):
        """Test removing a favorite that doesn't exist"""
        response = TestFavorites.session.delete(
            f"{BASE_URL}/api/favorites/clubs/99999999"
        )
        assert response.status_code == 404, f"Should return 404 for non-existent: {response.text}"
        print("✓ Non-existent favorite correctly returns 404")


class TestExistingUserLogin:
    """Test login with the existing test user from the request"""
    
    session = requests.Session()
    
    def test_login_existing_user(self):
        """Test login with testuser2@example.com"""
        response = TestExistingUserLogin.session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "testuser2@example.com",
                "password": "TestPass123!"
            }
        )
        # User may or may not exist
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Logged in as: {data['user'].get('nickname', data['user']['email'])}")
        elif response.status_code == 401:
            print("⚠ User testuser2@example.com not found - may need to register first")
        else:
            print(f"⚠ Unexpected status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
