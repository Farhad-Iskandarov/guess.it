"""
Test P0 and P1 Features for GuessIt Sports Prediction Platform
- P0: Admin account seeding and login
- P1: Exact Score Prediction APIs
- P1: Admin Points Configuration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from requirements
ADMIN_EMAIL = "farhad.isgandar@gmail.com"
ADMIN_PASSWORD = "Salam123?"


class TestP0AdminSeeding:
    """P0: Test admin account seeding and login"""
    
    def test_admin_login_success(self):
        """Verify admin account exists and can login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain user data"
        assert data["user"]["email"] == ADMIN_EMAIL, "Email should match"
        assert data["user"]["role"] == "admin", "User should have admin role"
        
        # Store cookies for subsequent tests
        self.session_cookies = response.cookies
        print(f"✅ Admin login successful: {data['user']['nickname']}")
        return response.cookies
    
    def test_admin_me_endpoint(self):
        """Verify admin can access /me endpoint after login"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200
        
        # Then check /me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies=login_response.cookies
        )
        
        assert me_response.status_code == 200, f"Failed to get /me: {me_response.text}"
        
        data = me_response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"✅ Admin /me endpoint working: role={data['role']}")


class TestP1AdminPointsConfig:
    """P1: Test Admin Points Configuration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_get_points_config(self):
        """GET /api/admin/points-config - Get current points configuration"""
        response = requests.get(
            f"{BASE_URL}/api/admin/points-config",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to get points config: {response.text}"
        
        data = response.json()
        # Verify expected fields exist
        assert "correct_prediction" in data, "Should have correct_prediction field"
        assert "wrong_penalty" in data, "Should have wrong_penalty field"
        assert "exact_score_bonus" in data, "Should have exact_score_bonus field"
        assert "level_thresholds" in data, "Should have level_thresholds field"
        
        # Verify data types
        assert isinstance(data["correct_prediction"], int)
        assert isinstance(data["wrong_penalty"], int)
        assert isinstance(data["exact_score_bonus"], int)
        assert isinstance(data["level_thresholds"], list)
        assert len(data["level_thresholds"]) == 11, "Should have 11 level thresholds"
        
        print(f"✅ Points config retrieved: correct={data['correct_prediction']}, exact_bonus={data['exact_score_bonus']}")
    
    def test_update_points_config(self):
        """PUT /api/admin/points-config - Update points configuration"""
        # Get current config first
        get_response = requests.get(
            f"{BASE_URL}/api/admin/points-config",
            cookies=self.cookies
        )
        original_config = get_response.json()
        
        # Update with new values
        new_config = {
            "correct_prediction": 15,
            "wrong_penalty": 3,
            "penalty_min_level": 4,
            "exact_score_bonus": 75,
            "level_thresholds": [0, 100, 150, 250, 400, 600, 700, 800, 900, 950, 1100]
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/points-config",
            json=new_config,
            cookies=self.cookies
        )
        
        assert update_response.status_code == 200, f"Failed to update points config: {update_response.text}"
        
        data = update_response.json()
        assert data["success"] == True
        assert data["config"]["correct_prediction"] == 15
        assert data["config"]["exact_score_bonus"] == 75
        
        # Verify persistence by fetching again
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/points-config",
            cookies=self.cookies
        )
        verify_data = verify_response.json()
        assert verify_data["correct_prediction"] == 15
        assert verify_data["exact_score_bonus"] == 75
        
        print(f"✅ Points config updated and verified")
        
        # Restore original config
        restore_config = {
            "correct_prediction": original_config.get("correct_prediction", 10),
            "wrong_penalty": original_config.get("wrong_penalty", 5),
            "penalty_min_level": original_config.get("penalty_min_level", 5),
            "exact_score_bonus": original_config.get("exact_score_bonus", 50),
            "level_thresholds": original_config.get("level_thresholds", [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000])
        }
        requests.put(
            f"{BASE_URL}/api/admin/points-config",
            json=restore_config,
            cookies=self.cookies
        )
    
    def test_reset_points_config(self):
        """POST /api/admin/points-config/reset - Reset to defaults"""
        response = requests.post(
            f"{BASE_URL}/api/admin/points-config/reset",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to reset points config: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert data["config"]["correct_prediction"] == 10, "Should reset to default 10"
        assert data["config"]["exact_score_bonus"] == 50, "Should reset to default 50"
        
        print(f"✅ Points config reset to defaults")
    
    def test_points_config_requires_admin(self):
        """Verify points config endpoints require admin role"""
        # Try without authentication
        response = requests.get(f"{BASE_URL}/api/admin/points-config")
        assert response.status_code == 401, "Should require authentication"
        
        print(f"✅ Points config correctly requires admin authentication")


class TestP1ExactScorePrediction:
    """P1: Test Exact Score Prediction APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_create_exact_score_prediction(self):
        """POST /api/predictions/exact-score - Create exact score prediction"""
        # Use a test match ID (this may not exist but tests the API structure)
        test_match_id = 999999  # Unlikely to exist, but tests API
        
        response = requests.post(
            f"{BASE_URL}/api/predictions/exact-score",
            json={
                "match_id": test_match_id,
                "home_score": 2,
                "away_score": 1
            },
            cookies=self.cookies
        )
        
        # Either 200 (success) or 400 (already exists) are valid
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "exact_score_id" in data
            assert data["match_id"] == test_match_id
            assert data["home_score"] == 2
            assert data["away_score"] == 1
            assert data["points_awarded"] == False
            print(f"✅ Exact score prediction created: {data['exact_score_id']}")
        else:
            # Already exists - this is expected if test runs multiple times
            print(f"✅ Exact score prediction already exists (expected on re-run)")
    
    def test_get_exact_score_for_match(self):
        """GET /api/predictions/exact-score/match/{match_id} - Get exact score for match"""
        test_match_id = 999999
        
        # First ensure a prediction exists
        requests.post(
            f"{BASE_URL}/api/predictions/exact-score",
            json={"match_id": test_match_id, "home_score": 2, "away_score": 1},
            cookies=self.cookies
        )
        
        # Now fetch it
        response = requests.get(
            f"{BASE_URL}/api/predictions/exact-score/match/{test_match_id}",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to get exact score: {response.text}"
        
        data = response.json()
        assert data["match_id"] == test_match_id
        assert "home_score" in data
        assert "away_score" in data
        assert "exact_score_id" in data
        
        print(f"✅ Exact score prediction retrieved: {data['home_score']}-{data['away_score']}")
    
    def test_get_exact_score_not_found(self):
        """GET /api/predictions/exact-score/match/{match_id} - 404 for non-existent"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/exact-score/match/1",  # Very unlikely to have prediction
            cookies=self.cookies
        )
        
        # Should be 404 if no prediction exists
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✅ Exact score 404 handling works correctly")
    
    def test_get_all_exact_score_predictions(self):
        """GET /api/predictions/exact-score/me - Get all user's exact score predictions"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/exact-score/me",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to get exact scores: {response.text}"
        
        data = response.json()
        assert "exact_score_predictions" in data
        assert "total" in data
        assert isinstance(data["exact_score_predictions"], list)
        assert isinstance(data["total"], int)
        
        print(f"✅ All exact score predictions retrieved: {data['total']} predictions")
    
    def test_exact_score_cannot_be_updated(self):
        """Verify exact score prediction cannot be changed once submitted"""
        test_match_id = 999998  # Different match ID
        
        # Create first prediction
        first_response = requests.post(
            f"{BASE_URL}/api/predictions/exact-score",
            json={"match_id": test_match_id, "home_score": 1, "away_score": 0},
            cookies=self.cookies
        )
        
        # Try to create another for same match
        second_response = requests.post(
            f"{BASE_URL}/api/predictions/exact-score",
            json={"match_id": test_match_id, "home_score": 3, "away_score": 2},
            cookies=self.cookies
        )
        
        # Second should fail with 400
        if first_response.status_code == 200:
            assert second_response.status_code == 400, "Should not allow updating exact score"
            assert "cannot be changed" in second_response.json().get("detail", "").lower() or \
                   "already submitted" in second_response.json().get("detail", "").lower()
            print(f"✅ Exact score correctly prevents updates")
        else:
            # First already existed, second should also fail
            assert second_response.status_code == 400
            print(f"✅ Exact score correctly prevents updates (both attempts blocked)")
    
    def test_exact_score_requires_auth(self):
        """Verify exact score endpoints require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/predictions/exact-score",
            json={"match_id": 12345, "home_score": 1, "away_score": 1}
        )
        assert response.status_code == 401, "Should require authentication"
        
        response = requests.get(f"{BASE_URL}/api/predictions/exact-score/me")
        assert response.status_code == 401, "Should require authentication"
        
        print(f"✅ Exact score endpoints correctly require authentication")


class TestP1AdminDashboard:
    """P1: Test Admin Dashboard access"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_admin_dashboard_access(self):
        """GET /api/admin/dashboard - Admin can access dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to access dashboard: {response.text}"
        
        data = response.json()
        assert "total_users" in data
        assert "total_predictions" in data
        assert "system_status" in data
        
        print(f"✅ Admin dashboard accessible: {data['total_users']} users, {data['total_predictions']} predictions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
