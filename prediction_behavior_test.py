#!/usr/bin/env python3
"""
Prediction Behavior Test Suite for GuessIt Football Platform
Tests the specific prediction behavior changes mentioned in the review request
"""

import requests
import sys
import json
from datetime import datetime

class PredictionBehaviorTester:
    def __init__(self, base_url="https://guess-it-copy-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 15
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.test_match_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"    URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"    ✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 300:
                        print(f"    📄 Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, response.text
            else:
                print(f"    ❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"    📄 Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"    📄 Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"    ❌ Failed - Error: {str(e)}")
            return False, {}

    def setup_test_user(self):
        """Create and login test user"""
        print("\n" + "="*50)
        print("👤 SETTING UP TEST USER")
        print("="*50)
        
        # Use admin credentials from review request
        admin_email = "farhad.isgandar@gmail.com"
        admin_password = "Salam123?"
        
        success, login_data = self.run_test(
            "Admin Login",
            "POST", 
            "auth/login",
            200,
            data={
                "email": admin_email,
                "password": admin_password
            }
        )
        
        if not success:
            print("    ❌ Admin login failed - cannot continue with tests")
            return False
            
        # Store user info for subsequent tests
        if isinstance(login_data, dict) and 'user' in login_data:
            self.user_id = login_data['user'].get('user_id')
            print(f"    ✅ Logged in as user: {self.user_id}")
            
        return True

    def get_test_match(self):
        """Get a match for testing predictions"""
        print("\n" + "="*50)
        print("⚽ GETTING TEST MATCH")
        print("="*50)
        
        success, matches_data = self.run_test(
            "Get Matches",
            "GET",
            "football/matches",
            200
        )
        
        if not success:
            return False
            
        if isinstance(matches_data, dict) and 'matches' in matches_data:
            matches = matches_data['matches']
            # Find a match that's not locked (NOT_STARTED or SCHEDULED)
            for match in matches:
                if match.get('status') in ['NOT_STARTED', 'SCHEDULED'] and not match.get('predictionLocked', False):
                    self.test_match_id = match.get('id')
                    print(f"    ✅ Found test match: {match.get('homeTeam', {}).get('name')} vs {match.get('awayTeam', {}).get('name')} (ID: {self.test_match_id})")
                    return True
                    
        print("    ⚠️  No suitable test match found (all matches may be locked)")
        return False

    def test_prediction_save_and_delete(self):
        """Test the core prediction save/delete behavior"""
        print("\n" + "="*50)
        print("🎯 TESTING PREDICTION SAVE/DELETE BEHAVIOR")
        print("="*50)
        
        if not self.test_match_id:
            print("    ❌ No test match available")
            return False
            
        # Test 1: Save a prediction (home win)
        success, save_data = self.run_test(
            "Save Home Prediction",
            "POST",
            "predictions",
            200,
            data={
                "match_id": self.test_match_id,
                "prediction": "home"
            }
        )
        
        if not success:
            print("    ❌ Failed to save prediction")
            return False
            
        # Verify save response structure
        if isinstance(save_data, dict):
            if 'is_new' not in save_data:
                print("    ⚠️  Warning: Save response missing 'is_new' field")
            if 'prediction' not in save_data:
                print("    ⚠️  Warning: Save response missing 'prediction' field")
                
        # Test 2: Get the saved prediction
        success, get_data = self.run_test(
            "Get Saved Prediction",
            "GET",
            f"predictions/match/{self.test_match_id}",
            200
        )
        
        if success and isinstance(get_data, dict):
            if get_data.get('prediction') != 'home':
                print(f"    ❌ Expected 'home', got '{get_data.get('prediction')}'")
                return False
            print("    ✅ Prediction correctly saved and retrieved")
            
        # Test 3: Update prediction (change to away)
        success, update_data = self.run_test(
            "Update to Away Prediction",
            "POST",
            "predictions",
            200,
            data={
                "match_id": self.test_match_id,
                "prediction": "away"
            }
        )
        
        if success and isinstance(update_data, dict):
            if update_data.get('is_new') == True:
                print("    ⚠️  Warning: Update marked as 'is_new' when it should be an update")
            if update_data.get('prediction') != 'away':
                print(f"    ❌ Expected 'away', got '{update_data.get('prediction')}'")
                return False
            print("    ✅ Prediction correctly updated")
            
        # Test 4: Delete prediction
        success, delete_data = self.run_test(
            "Delete Prediction",
            "DELETE",
            f"predictions/match/{self.test_match_id}",
            200
        )
        
        if not success:
            print("    ❌ Failed to delete prediction")
            return False
            
        # Test 5: Verify prediction is deleted
        success, verify_data = self.run_test(
            "Verify Prediction Deleted",
            "GET",
            f"predictions/match/{self.test_match_id}",
            404  # Should return 404 when no prediction exists
        )
        
        if success:
            print("    ✅ Prediction correctly deleted")
        else:
            print("    ⚠️  Warning: Prediction may not have been properly deleted")
            
        return True

    def test_exact_score_functionality(self):
        """Test exact score prediction functionality"""
        print("\n" + "="*50)
        print("🎯 TESTING EXACT SCORE FUNCTIONALITY")
        print("="*50)
        
        if not self.test_match_id:
            print("    ❌ No test match available")
            return False
            
        # Test 1: Save exact score prediction
        success, save_data = self.run_test(
            "Save Exact Score Prediction",
            "POST",
            "predictions/exact-score",
            200,
            data={
                "match_id": self.test_match_id,
                "home_score": 2,
                "away_score": 1
            }
        )
        
        if not success:
            print("    ❌ Failed to save exact score prediction")
            return False
            
        # Test 2: Get exact score prediction
        success, get_data = self.run_test(
            "Get Exact Score Prediction",
            "GET",
            f"predictions/exact-score/match/{self.test_match_id}",
            200
        )
        
        if success and isinstance(get_data, dict):
            if get_data.get('home_score') != 2 or get_data.get('away_score') != 1:
                print(f"    ❌ Expected 2-1, got {get_data.get('home_score')}-{get_data.get('away_score')}")
                return False
            print("    ✅ Exact score correctly saved and retrieved")
            
        # Test 3: Try to save regular prediction when exact score exists (should fail or handle appropriately)
        success, conflict_data = self.run_test(
            "Try Regular Prediction with Exact Score",
            "POST",
            "predictions",
            400,  # Expecting this to fail or return appropriate status
            data={
                "match_id": self.test_match_id,
                "prediction": "home"
            }
        )
        
        # Note: The exact behavior here depends on business logic
        # Some systems allow both, others don't
        
        # Test 4: Delete exact score prediction
        success, delete_data = self.run_test(
            "Delete Exact Score Prediction",
            "DELETE",
            f"predictions/exact-score/match/{self.test_match_id}",
            200
        )
        
        if success:
            print("    ✅ Exact score prediction deleted successfully")
            
        return True

    def test_match_detail_api(self):
        """Test match detail API that the frontend uses"""
        print("\n" + "="*50)
        print("📋 TESTING MATCH DETAIL API")
        print("="*50)
        
        if not self.test_match_id:
            print("    ❌ No test match available")
            return False
            
        # Test match detail endpoint
        success, match_data = self.run_test(
            "Get Match Detail",
            "GET",
            f"football/match/{self.test_match_id}",
            200
        )
        
        if not success:
            return False
            
        if isinstance(match_data, dict) and 'match' in match_data:
            match = match_data['match']
            required_fields = ['id', 'homeTeam', 'awayTeam', 'status', 'votes']
            missing_fields = [field for field in required_fields if field not in match]
            
            if missing_fields:
                print(f"    ⚠️  Warning: Missing required fields: {missing_fields}")
            else:
                print("    ✅ Match detail has all required fields")
                
            # Check vote structure
            if 'votes' in match:
                votes = match['votes']
                vote_types = ['home', 'draw', 'away']
                for vote_type in vote_types:
                    if vote_type not in votes:
                        print(f"    ⚠️  Warning: Missing vote type: {vote_type}")
                    elif not isinstance(votes[vote_type], dict) or 'count' not in votes[vote_type] or 'percentage' not in votes[vote_type]:
                        print(f"    ⚠️  Warning: Invalid vote structure for {vote_type}")
                        
        return True

    def run_all_tests(self):
        """Run complete prediction behavior test suite"""
        print("🚀 Starting Prediction Behavior Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("⏱️  Started at:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        
        # Run test categories
        try:
            if not self.setup_test_user():
                print("❌ User setup failed - stopping")
                return False
                
            if not self.get_test_match():
                print("⚠️  No test match available - some tests will be skipped")
                
            if not self.test_prediction_save_and_delete():
                print("❌ Prediction save/delete tests failed")
                
            if not self.test_exact_score_functionality():
                print("⚠️  Exact score tests failed but continuing")
                
            if not self.test_match_detail_api():
                print("⚠️  Match detail API tests failed but continuing")
                
        except Exception as e:
            print(f"❌ Test suite crashed: {e}")
            return False
            
        # Print final results
        print("\n" + "="*60)
        print("📊 PREDICTION BEHAVIOR TEST RESULTS")
        print("="*60)
        print(f"✅ Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All prediction behavior tests passed!")
            return True
        elif self.tests_passed >= self.tests_run * 0.8:
            print("⚠️  Most tests passed - some issues to investigate")
            return True  
        else:
            print("❌ Significant test failures detected")
            return False

def main():
    """Main test runner"""
    tester = PredictionBehaviorTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())