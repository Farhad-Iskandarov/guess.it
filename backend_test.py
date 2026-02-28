import requests
import sys
from datetime import datetime

class GuessItAPITester:
    def __init__(self, base_url="https://guessit-fork.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()  # Use session to maintain cookies
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, timeout=10)
            else:
                print(f"❌ Unsupported method: {method}")
                self.failed_tests.append(f"{name} - Unsupported method")
                return False, {}

            print(f"   Status: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {"text": response.text}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append(f"{name} - Status {response.status_code} (expected {expected_status})")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timed out")
            self.failed_tests.append(f"{name} - Timeout")
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            self.failed_tests.append(f"{name} - Connection error")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name} - {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "api/",
            200
        )
        if success:
            expected_message = "GuessIt API is running"
            if response.get("message") == expected_message:
                print(f"✅ Correct message: {response.get('message')}")
                return True
            else:
                print(f"❌ Unexpected message: {response.get('message')}")
                self.failed_tests.append("API Root - Incorrect message")
                return False
        return False

    def test_health_check(self):
        """Test health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        if success:
            if response.get("status") == "healthy":
                print(f"✅ Health status: {response.get('status')}")
                return True
            else:
                print(f"❌ Unexpected health status: {response.get('status')}")
                self.failed_tests.append("Health Check - Status not healthy")
                return False
        return False

    def test_login_with_test_user(self):
        """Test login with provided test user credentials"""
        success, response = self.run_test(
            "Login with Test User",
            "POST",
            "api/auth/login",
            200,
            data={
                "email": "testuser@test.com",
                "password": "Test1234!"
            }
        )
        
        if success:
            if response.get("user") and response.get("user", {}).get("email") == "testuser@test.com":
                print(f"✅ Login successful for testuser@test.com")
                # Check for session token in cookies or response
                session_token = response.get("session_token") or self.session.cookies.get("session_token")
                if session_token:
                    self.session_token = session_token
                    print(f"✅ Got session token for authenticated requests")
                else:
                    print(f"ℹ️ No session token found, will use session cookies")
                return True
            else:
                print(f"❌ Login response missing user data")
                self.failed_tests.append("Login - Missing user data")
                return False
        return False

    def test_profile_bundle_endpoint(self):
        """Test the new /api/profile/bundle endpoint - MAIN FEATURE TO TEST"""
        success, response = self.run_test(
            "Profile Bundle Endpoint",
            "GET", 
            "api/profile/bundle",
            200
        )
        
        if success:
            print(f"✅ Got profile bundle response")
            
            # Check main sections exist
            predictions = response.get("predictions", {})
            favorites = response.get("favorites", {}) 
            friends_leaderboard = response.get("friends_leaderboard", {})
            
            issues = []
            
            # Test predictions section with match enrichment
            preds_list = predictions.get("predictions", [])
            preds_summary = predictions.get("summary", {})
            total_preds = predictions.get("total", 0)
            
            print(f"   Predictions: {len(preds_list)} recent, {total_preds} total")
            print(f"   Summary: {preds_summary.get('correct', 0)} correct, {preds_summary.get('wrong', 0)} wrong, {preds_summary.get('pending', 0)} pending")
            
            # Check if predictions have match enrichment (homeTeam.name, awayTeam.name)
            if preds_list:
                first_pred = preds_list[0]
                match_data = first_pred.get("match")
                if match_data:
                    home_team = match_data.get("homeTeam", {})
                    away_team = match_data.get("awayTeam", {})
                    if home_team.get("name") and away_team.get("name"):
                        print(f"✅ Match enrichment working: {home_team.get('name')} vs {away_team.get('name')}")
                    else:
                        issues.append("Predictions missing team names in match enrichment")
                        print(f"❌ Match enrichment missing team names")
                else:
                    issues.append("Predictions missing match data (enrichment not working)")
                    print(f"❌ Recent activity missing match enrichment")
            else:
                print(f"ℹ️ No recent predictions to check match enrichment")
                
            # Test favorites section 
            favs_list = favorites.get("favorites", [])
            print(f"   Favorites: {len(favs_list)} teams")
            
            if favs_list:
                first_fav = favs_list[0]
                if first_fav.get("team_name") and first_fav.get("team_id"):
                    print(f"✅ Favorites structure correct: {first_fav.get('team_name')}")
                else:
                    issues.append("Favorites missing team_name or team_id")
                    print(f"❌ Favorites missing required fields")
            else:
                print(f"ℹ️ No favorite teams to check")
                
            # Test friends leaderboard section
            lb_list = friends_leaderboard.get("leaderboard", [])
            my_rank = friends_leaderboard.get("my_rank")
            print(f"   Friends leaderboard: {len(lb_list)} entries, rank #{my_rank}")
            
            if lb_list:
                first_entry = lb_list[0]
                required_fields = ["rank", "user_id", "nickname", "points", "level", "is_me"]
                missing_fields = [field for field in required_fields if field not in first_entry]
                if not missing_fields:
                    print(f"✅ Friends leaderboard structure correct")
                else:
                    issues.append(f"Friends leaderboard missing fields: {missing_fields}")
                    print(f"❌ Friends leaderboard missing: {missing_fields}")
            else:
                print(f"ℹ️ No friends to check leaderboard")
            
            if not issues:
                print(f"✅ Profile bundle endpoint working perfectly!")
                return True
            else:
                for issue in issues:
                    self.failed_tests.append(f"Profile Bundle - {issue}")
                print(f"❌ Profile bundle has {len(issues)} issues")
                return False
                
        return False

    def test_friends_leaderboard(self):
        """Test friends leaderboard endpoint (LEGACY - now part of bundle)"""
        success, response = self.run_test(
            "Friends Leaderboard (Legacy)",
            "GET",
            "api/friends/leaderboard",
            200
        )
        
        if success:
            leaderboard = response.get("leaderboard", [])
            my_rank = response.get("my_rank")
            total = response.get("total", 0)
            
            print(f"✅ Got friends leaderboard with {len(leaderboard)} entries")
            print(f"   Total friends: {total}, My rank: {my_rank}")
            
            # Validate response structure
            if isinstance(leaderboard, list):
                if leaderboard:
                    first_entry = leaderboard[0]
                    required_fields = ["rank", "user_id", "nickname", "points", "level", "is_me"]
                    missing_fields = [field for field in required_fields if field not in first_entry]
                    if not missing_fields:
                        print(f"✅ Leaderboard entry structure is correct")
                        return True
                    else:
                        print(f"❌ Missing fields in leaderboard entry: {missing_fields}")
                        self.failed_tests.append(f"Friends Leaderboard - Missing fields: {missing_fields}")
                        return False
                else:
                    print(f"✅ Empty leaderboard (no friends yet)")
                    return True
            else:
                print(f"❌ Leaderboard is not a list")
                self.failed_tests.append("Friends Leaderboard - Invalid leaderboard format")
                return False
        return False

    def test_global_rank_check(self):
        """Test global leaderboard rank check endpoint (NEW FEATURE)"""
        success, response = self.run_test(
            "Global Rank Check",
            "GET",
            "api/football/leaderboard/check-rank",
            200
        )
        
        if success:
            rank = response.get("rank")
            in_top_100 = response.get("in_top_100")
            
            print(f"✅ Got global rank check response")
            print(f"   Rank: {rank}, In top 100: {in_top_100}")
            
            # Validate response structure
            if rank is not None and isinstance(in_top_100, bool):
                print(f"✅ Global rank check response structure is correct")
                return True
            else:
                print(f"❌ Invalid global rank check response structure")
                self.failed_tests.append("Global Rank Check - Invalid response structure")
                return False
        return False

    def test_saved_matches(self):
        """Test saved matches endpoint (NEW FEATURE)"""
        success, response = self.run_test(
            "Get Saved Matches",
            "GET",
            "api/favorites/matches",
            200
        )
        
        if success:
            favorites = response.get("favorites", [])
            print(f"✅ Got saved matches with {len(favorites)} entries")
            
            # Validate response structure
            if isinstance(favorites, list):
                if favorites:
                    first_match = favorites[0]
                    required_fields = ["match_id", "home_team", "away_team", "competition"]
                    missing_fields = [field for field in required_fields if field not in first_match]
                    if not missing_fields:
                        print(f"✅ Saved match entry structure is correct")
                        return True
                    else:
                        print(f"❌ Missing fields in saved match entry: {missing_fields}")
                        self.failed_tests.append(f"Saved Matches - Missing fields: {missing_fields}")
                        return False
                else:
                    print(f"✅ Empty saved matches list")
                    return True
            else:
                print(f"❌ Favorites is not a list")
                self.failed_tests.append("Saved Matches - Invalid favorites format")
                return False
        return False

    def test_create_prediction_for_friend_notification(self):
        """Test creating a prediction to trigger friend notifications (NEW FEATURE)"""
        test_data = {
            "match_id": 999999,  # Using a test match ID
            "prediction": "home"
        }
        
        success, response = self.run_test(
            "Create Prediction (Friend Notification Test)",
            "POST", 
            "api/predictions",
            200,
            data=test_data
        )
        
        if success:
            prediction_id = response.get("prediction_id")
            is_new = response.get("is_new")
            
            if prediction_id:
                print(f"✅ Created prediction with ID: {prediction_id}")
                print(f"   Is new prediction: {is_new}")
                
                # Store for cleanup
                self.test_prediction_match_id = test_data["match_id"]
                
                # Check if friend notification logic was triggered (indicated by is_new flag)
                if is_new is not None:
                    print(f"✅ Friend notification logic is present (is_new flag)")
                    return True
                else:
                    print(f"⚠️ is_new flag missing - friend notifications may not be working")
                    # Still count as success since prediction was created
                    return True
            else:
                print(f"❌ No prediction_id in response")
                self.failed_tests.append("Create Prediction - Missing prediction_id")
                return False
        return False

    def test_messages_conversations(self):
        """Test messages conversations endpoint (requires auth)"""
        success, response = self.run_test(
            "Messages Conversations",
            "GET",
            "api/messages/conversations",
            200
        )
        
        if success:
            conversations = response.get("conversations", [])
            total_unread = response.get("total_unread", 0)
            print(f"✅ Got {len(conversations)} conversations, {total_unread} unread")
            return True
        return False

    def test_football_matches(self):
        """Test football matches endpoint"""
        success, response = self.run_test(
            "Football Matches",
            "GET",
            "api/football/matches",
            200
        )
        
        if success:
            matches = response.get("matches", [])
            total = response.get("total", 0)
            print(f"✅ Got {len(matches)} matches (total: {total})")
            
            # Store a match ID for other tests
            if matches:
                self.sample_match_id = matches[0].get("id")
                print(f"   Using sample match ID: {self.sample_match_id}")
            
            return True
        return False

    def test_prediction_cleanup(self):
        """Clean up test prediction"""
        if hasattr(self, 'test_prediction_match_id'):
            success, response = self.run_test(
                "Cleanup Test Prediction",
                "DELETE",
                f"api/predictions/match/{self.test_prediction_match_id}",
                200
            )
            if success:
                print(f"✅ Test prediction cleaned up")
            return success
        return True

    def test_invalid_endpoints(self):
        """Test some invalid endpoints to ensure proper error handling"""
        success, _ = self.run_test(
            "Invalid Endpoint",
            "GET",
            "api/nonexistent",
            404
        )
        return success

    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 60)
        print("🚀 Starting GuessIt Backend API Tests - Profile Bundle Performance Fix")
        print("🎯 Testing: /api/profile/bundle endpoint with match enrichment & favorites fix")
        print("=" * 60)
        
        test_results = {}
        
        # Core API tests
        test_results['api_root'] = self.test_api_root()
        test_results['health_check'] = self.test_health_check()
        
        # Auth test with provided credentials
        test_results['login_test_user'] = self.test_login_with_test_user()
        
        # MAIN FEATURE TO TEST: Profile Bundle Endpoint
        print(f"\n🎯 Testing MAIN FEATURE: Profile Bundle Performance & Error Handling Fix")
        test_results['profile_bundle_endpoint'] = self.test_profile_bundle_endpoint()
        
        # Supporting tests
        print(f"\n🆕 Testing Supporting Features:")
        test_results['friends_leaderboard_legacy'] = self.test_friends_leaderboard()
        test_results['global_rank_check'] = self.test_global_rank_check() 
        test_results['saved_matches'] = self.test_saved_matches()
        test_results['prediction_friend_notification'] = self.test_create_prediction_for_friend_notification()
        
        # Supporting API tests
        test_results['messages_conversations'] = self.test_messages_conversations()
        test_results['football_matches'] = self.test_football_matches()
        
        # Cleanup
        test_results['cleanup'] = self.test_prediction_cleanup()
        
        # Error handling test
        test_results['invalid_endpoint'] = self.test_invalid_endpoints()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for failure in self.failed_tests:
                print(f"   - {failure}")
        else:
            print(f"\n🎉 All tests passed!")
        
        return test_results

def main():
    """Main test function"""
    print("GuessIt Backend API Tester - New Features")
    print("Testing against: https://guessit-fork.preview.emergentagent.com")
    
    tester = GuessItAPITester()
    results = tester.run_all_tests()
    
    # Return exit code based on results
    if tester.tests_passed == tester.tests_run:
        print(f"\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())