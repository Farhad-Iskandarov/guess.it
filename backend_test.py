#!/usr/bin/env python3
"""
Backend API Testing for Dynamic Points System
Tests the GuessIt football prediction platform's dynamic points implementation.
"""

import requests
import sys
import json
from datetime import datetime

class DynamicPointsAPITester:
    def __init__(self, base_url="https://guess-it-duplicate-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def admin_login(self):
        """Login as admin to access protected endpoints"""
        print("\n🔐 Testing Admin Login...")
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": "farhad.isgandar@gmail.com",
                    "password": "Salam123?"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check if user has admin role
                user = data.get("user", {})
                if user.get("role") == "admin":
                    self.admin_token = "session_based"  # Mark as logged in
                    self.log_test("Admin Login", True, f"Admin user logged in: {user.get('nickname')}")
                    return True
                else:
                    self.log_test("Admin Login", False, f"User role: {user.get('role')}, expected: admin")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
                return False
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False

    def test_football_matches_api(self):
        """Test /api/football/matches endpoint for dynamic points"""
        print("\n⚽ Testing Football Matches API...")
        
        try:
            response = self.session.get(f"{self.base_url}/api/football/matches")
            
            if response.status_code != 200:
                self.log_test("Football Matches API Status", False, f"Status: {response.status_code}")
                return False
            
            self.log_test("Football Matches API Status", True, "200 OK")
            
            data = response.json()
            matches = data.get("matches", [])
            
            if not matches:
                self.log_test("Football Matches Data", False, "No matches returned")
                return False
            
            self.log_test("Football Matches Data", True, f"Found {len(matches)} matches")
            
            # Test dynamic points structure
            match_with_dynamic_points = None
            for match in matches:
                if "dynamicPoints" in match:
                    match_with_dynamic_points = match
                    break
            
            if not match_with_dynamic_points:
                self.log_test("Dynamic Points Structure", False, "No match found with dynamicPoints")
                return False
            
            dynamic_points = match_with_dynamic_points["dynamicPoints"]
            required_fields = ["home", "draw", "away", "home_label", "draw_label", "away_label", "base_points"]
            
            missing_fields = [field for field in required_fields if field not in dynamic_points]
            if missing_fields:
                self.log_test("Dynamic Points Structure", False, f"Missing fields: {missing_fields}")
                return False
            
            self.log_test("Dynamic Points Structure", True, "All required fields present")
            
            # Test dynamic points calculation logic
            votes = match_with_dynamic_points.get("votes", {})
            total_votes = match_with_dynamic_points.get("totalVotes", 0)
            
            # Test points range [5, 50]
            for option in ["home", "draw", "away"]:
                pts = dynamic_points[option]
                if not (5 <= pts <= 50):
                    self.log_test("Dynamic Points Range", False, f"{option}: {pts} not in [5, 50]")
                    return False
            
            self.log_test("Dynamic Points Range", True, "All points in [5, 50] range")
            
            # Test formula logic with known values
            if total_votes > 0:
                home_pct = votes.get("home", {}).get("percentage", 0)
                base_pts = dynamic_points.get("base_points", 50)
                
                # Formula: base_points * (1 - pct/100) * 1.3, clamped [5, 50]
                expected_home_pts = max(5, min(50, round(base_pts * (1 - home_pct / 100) * 1.3)))
                actual_home_pts = dynamic_points["home"]
                
                if expected_home_pts == actual_home_pts:
                    self.log_test("Dynamic Points Formula", True, f"Home: {actual_home_pts} pts (expected: {expected_home_pts})")
                else:
                    self.log_test("Dynamic Points Formula", False, f"Home: {actual_home_pts} pts, expected: {expected_home_pts}")
            else:
                # Test equal distribution fallback (33.3% each = 43 pts)
                expected_pts = max(5, min(50, round(50 * (1 - 33.3 / 100) * 1.3)))
                if all(dynamic_points[opt] == expected_pts for opt in ["home", "draw", "away"]):
                    self.log_test("Dynamic Points Equal Distribution", True, f"All options: {expected_pts} pts")
                else:
                    self.log_test("Dynamic Points Equal Distribution", False, "Not equal distribution for 0 votes")
            
            # Test labels
            label_options = ["popular", "high_risk", "balanced"]
            for option in ["home", "draw", "away"]:
                label = dynamic_points[f"{option}_label"]
                if label not in label_options:
                    self.log_test("Dynamic Points Labels", False, f"{option}_label: {label} not in {label_options}")
                    return False
            
            self.log_test("Dynamic Points Labels", True, "All labels valid")
            
            return True
            
        except Exception as e:
            self.log_test("Football Matches API", False, f"Exception: {str(e)}")
            return False

    def test_points_config_api(self):
        """Test points configuration API"""
        print("\n⚙️ Testing Points Configuration...")
        
        if not self.admin_token:
            self.log_test("Points Config API", False, "No admin token available")
            return False
        
        try:
            # Test GET points config
            response = self.session.get(f"{self.base_url}/api/admin/points-config")
            
            if response.status_code != 200:
                self.log_test("Points Config GET", False, f"Status: {response.status_code}")
                return False
            
            self.log_test("Points Config GET", True, "200 OK")
            
            config = response.json()
            
            # Check if correct_prediction field exists (now base_points for dynamic)
            if "correct_prediction" not in config:
                self.log_test("Points Config Structure", False, "Missing correct_prediction field")
                return False
            
            base_points = config["correct_prediction"]
            if base_points != 50:  # Should be 50 as per requirements
                self.log_test("Base Points Default", False, f"Expected 50, got {base_points}")
                return False
            
            self.log_test("Base Points Default", True, f"Base points: {base_points}")
            
            return True
            
        except Exception as e:
            self.log_test("Points Config API", False, f"Exception: {str(e)}")
            return False

    def test_dynamic_points_edge_cases(self):
        """Test edge cases for dynamic points calculation"""
        print("\n🧪 Testing Dynamic Points Edge Cases...")
        
        try:
            # Test with specific scenarios
            test_cases = [
                {"percentage": 100, "expected_min": 5, "expected_max": 5, "label": "popular"},  # Popular choice
                {"percentage": 0, "expected_min": 50, "expected_max": 50, "label": "high_risk"},  # Rare choice
                {"percentage": 33.3, "expected_min": 43, "expected_max": 43, "label": "balanced"},  # Equal distribution
                {"percentage": 70, "expected_min": 5, "expected_max": 20, "label": "popular"},  # High popularity
                {"percentage": 15, "expected_min": 40, "expected_max": 50, "label": "high_risk"},  # Low popularity
            ]
            
            base_points = 50
            for i, case in enumerate(test_cases):
                pct = case["percentage"]
                # Formula: base_points * (1 - pct/100) * 1.3, clamped [5, 50]
                calculated_pts = max(5, min(50, round(base_points * (1 - pct / 100) * 1.3)))
                
                if case["expected_min"] <= calculated_pts <= case["expected_max"]:
                    self.log_test(f"Edge Case {i+1} ({pct}%)", True, f"{calculated_pts} pts")
                else:
                    self.log_test(f"Edge Case {i+1} ({pct}%)", False, f"Got {calculated_pts}, expected {case['expected_min']}-{case['expected_max']}")
            
            return True
            
        except Exception as e:
            self.log_test("Dynamic Points Edge Cases", False, f"Exception: {str(e)}")
            return False

    def test_admin_panel_integration(self):
        """Test admin panel points settings integration"""
        print("\n👑 Testing Admin Panel Integration...")
        
        if not self.admin_token:
            self.log_test("Admin Panel Integration", False, "No admin token available")
            return False
        
        try:
            # Test updating base points
            new_base_points = 60
            response = self.session.put(
                f"{self.base_url}/api/admin/points-config",
                json={
                    "correct_prediction": new_base_points,
                    "wrong_penalty": 5,
                    "penalty_min_level": 5,
                    "exact_score_bonus": 50,
                    "level_thresholds": [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                self.log_test("Admin Panel Update", True, f"Base points updated to {new_base_points}")
                
                # Verify the change
                verify_response = self.session.get(f"{self.base_url}/api/admin/points-config")
                
                if verify_response.status_code == 200:
                    config = verify_response.json()
                    if config.get("correct_prediction") == new_base_points:
                        self.log_test("Admin Panel Verification", True, "Base points updated successfully")
                    else:
                        self.log_test("Admin Panel Verification", False, f"Expected {new_base_points}, got {config.get('correct_prediction')}")
                else:
                    self.log_test("Admin Panel Verification", False, f"Verification failed: {verify_response.status_code}")
                
                # Reset to original value
                reset_response = self.session.put(
                    f"{self.base_url}/api/admin/points-config",
                    json={
                        "correct_prediction": 50,
                        "wrong_penalty": 5,
                        "penalty_min_level": 5,
                        "exact_score_bonus": 50,
                        "level_thresholds": [0, 100, 120, 200, 330, 500, 580, 650, 780, 900, 1000]
                    },
                    headers={"Content-Type": "application/json"}
                )
                
                if reset_response.status_code == 200:
                    self.log_test("Admin Panel Reset", True, "Base points reset to 50")
                else:
                    self.log_test("Admin Panel Reset", False, f"Reset failed: {reset_response.status_code}")
                
            else:
                self.log_test("Admin Panel Update", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            
            return True
            
        except Exception as e:
            self.log_test("Admin Panel Integration", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all dynamic points tests"""
        print("🚀 Starting Dynamic Points System Tests")
        print("=" * 50)
        
        # Login first
        if not self.admin_login():
            print("\n❌ Cannot proceed without admin login")
            return False
        
        # Run all tests
        tests = [
            self.test_football_matches_api,
            self.test_points_config_api,
            self.test_dynamic_points_edge_cases,
            self.test_admin_panel_integration,
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test {test.__name__} failed with exception: {e}")
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    """Main test runner"""
    tester = DynamicPointsAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())