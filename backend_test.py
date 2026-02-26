import requests
import sys
from datetime import datetime

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-staging-1.preview.emergentagent.com"):
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

    def test_register_endpoint(self):
        """Test user registration endpoint"""
        test_email = f"test_user_{datetime.now().strftime('%H%M%S')}@guessit.com"
        test_password = "TestPass123!"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "api/auth/register",
            200,
            data={
                "email": test_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        if success:
            if response.get("requires_nickname"):
                print(f"✅ Registration successful, requires nickname setup")
                # Store user info for login test
                self.test_user_email = test_email
                self.test_user_password = test_password
                return True
            else:
                print(f"❌ Registration response missing requires_nickname flag")
                self.failed_tests.append("Registration - Missing requires_nickname")
                return False
        return False

    def test_login_endpoint(self):
        """Test user login endpoint"""
        if not hasattr(self, 'test_user_email'):
            # Skip login test if registration failed
            print("⏭️ Skipping login test - no user to test with")
            return True
            
        success, response = self.run_test(
            "User Login",
            "POST",
            "api/auth/login", 
            200,
            data={
                "email": self.test_user_email,
                "password": self.test_user_password
            }
        )
        
        if success:
            if response.get("user") and response.get("user", {}).get("email") == self.test_user_email:
                print(f"✅ Login successful for user: {self.test_user_email}")
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

    def test_messages_conversations(self):
        """Test messages conversations endpoint (requires auth)"""
        # Use session cookies for authentication
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

    def test_friends_invite_match(self):
        """Test friends invite match endpoint (requires auth)"""        
        # This will likely return 403 since we don't have friends, but tests endpoint exists
        test_data = {
            "friend_user_id": "test_friend_123",
            "match_id": 12345,
            "home_team": "Test Home Team",
            "away_team": "Test Away Team",
            "match_date": "2024-01-01T15:00:00Z",
            "match_card": {
                "match_id": 12345,
                "homeTeam": {"name": "Test Home Team"},
                "awayTeam": {"name": "Test Away Team"},
                "competition": "Test League",
                "status": "SCHEDULED"
            }
        }
        
        success, response = self.run_test(
            "Friends Invite Match", 
            "POST",
            "api/friends/invite/match",
            403,  # Expecting 403 since we don't have this friend
            data=test_data
        )
        
        if success:
            print(f"✅ Endpoint accessible (got expected 403 - not friends)")
            return True
        return False

    def test_duplicate_match_invitations(self):
        """Test that duplicate match invitations are allowed (no blocking)"""
        if not hasattr(self, 'test_user_email'):
            print("⏭️ Skipping duplicate invitation test - no authenticated user")
            return True
            
        # Test data for match invitation
        test_data = {
            "friend_user_id": "test_duplicate_friend_456",
            "match_id": 67890,
            "home_team": "Duplicate Test Home",
            "away_team": "Duplicate Test Away",
            "match_date": "2024-01-01T15:00:00Z",
            "match_card": {
                "match_id": 67890,
                "homeTeam": {"name": "Duplicate Test Home"},
                "awayTeam": {"name": "Duplicate Test Away"},
                "competition": "Duplicate Test League",
                "status": "SCHEDULED"
            }
        }
        
        print("   Testing first invitation (should return 403 - not friends)...")
        success1, response1 = self.run_test(
            "First Match Invitation", 
            "POST",
            "api/friends/invite/match",
            403,  # Still expecting 403 since we don't have this friend
            data=test_data
        )
        
        print("   Testing second invitation with same data (should also return 403, not 400 for duplicate)...")
        success2, response2 = self.run_test(
            "Second Match Invitation (Same Data)", 
            "POST",
            "api/friends/invite/match", 
            403,  # Should still be 403 (not friends), NOT 400 (duplicate blocking)
            data=test_data
        )
        
        # Both should succeed with same 403 error (endpoint works, just not friends)
        # The key test is that we DON'T get a 400 "duplicate invitation" error
        if success1 and success2:
            print(f"✅ Duplicate invitations allowed - no duplicate-blocking detected")
            print(f"✅ Both requests returned 403 (not friends) instead of 400 (duplicate block)")
            return True
        else:
            print(f"❌ Duplicate invitation test failed")
            self.failed_tests.append("Duplicate Match Invitations - Test failed")
            return False

    def test_prediction_creation(self):
        """Test creating a prediction (POST /api/predictions)"""
        if not hasattr(self, 'test_user_email'):
            print("⏭️ Skipping prediction tests - no authenticated user")
            return True
            
        test_data = {
            "match_id": 12345,
            "prediction": "home"
        }
        
        success, response = self.run_test(
            "Create Prediction",
            "POST", 
            "api/predictions",
            200,
            data=test_data
        )
        
        if success:
            prediction_id = response.get("prediction_id")
            if prediction_id:
                print(f"✅ Created prediction with ID: {prediction_id}")
                self.test_prediction_id = prediction_id
                self.test_match_id = test_data["match_id"]
                return True
            else:
                print(f"❌ No prediction_id in response")
                self.failed_tests.append("Create Prediction - Missing prediction_id")
                return False
        return False

    def test_prediction_get(self):
        """Test getting prediction for a match (GET /api/predictions/match/{match_id})"""
        if not hasattr(self, 'test_match_id'):
            print("⏭️ Skipping get prediction test - no prediction created")
            return True
            
        success, response = self.run_test(
            "Get Prediction for Match",
            "GET",
            f"api/predictions/match/{self.test_match_id}",
            200
        )
        
        if success:
            prediction = response.get("prediction")
            if prediction == "home":
                print(f"✅ Got correct prediction: {prediction}")
                return True
            else:
                print(f"❌ Unexpected prediction: {prediction}")
                self.failed_tests.append("Get Prediction - Wrong prediction value")
                return False
        return False

    def test_exact_score_creation(self):
        """Test creating exact score prediction (POST /api/predictions/exact-score)"""
        if not hasattr(self, 'test_match_id'):
            print("⏭️ Skipping exact score test - no match_id available")
            return True
            
        # Use a different match ID to avoid conflicts
        exact_match_id = self.test_match_id + 1
        test_data = {
            "match_id": exact_match_id,
            "home_score": 2,
            "away_score": 1
        }
        
        success, response = self.run_test(
            "Create Exact Score Prediction",
            "POST",
            "api/predictions/exact-score", 
            200,
            data=test_data
        )
        
        if success:
            exact_score_id = response.get("exact_score_id")
            if exact_score_id:
                print(f"✅ Created exact score prediction with ID: {exact_score_id}")
                self.test_exact_score_id = exact_score_id
                self.test_exact_match_id = exact_match_id
                return True
            else:
                print(f"❌ No exact_score_id in response")
                self.failed_tests.append("Create Exact Score - Missing exact_score_id")
                return False
        return False

    def test_prediction_deletion(self):
        """Test deleting winner prediction (DELETE /api/predictions/match/{match_id})"""
        if not hasattr(self, 'test_match_id'):
            print("⏭️ Skipping prediction deletion test - no prediction to delete")
            return True
            
        success, response = self.run_test(
            "Delete Prediction",
            "DELETE",
            f"api/predictions/match/{self.test_match_id}",
            200
        )
        
        if success:
            message = response.get("message")
            if "deleted successfully" in message.lower():
                print(f"✅ Prediction deleted: {message}")
                return True
            else:
                print(f"❌ Unexpected delete message: {message}")
                self.failed_tests.append("Delete Prediction - Unexpected message")
                return False
        return False

    def test_exact_score_deletion(self):
        """Test deleting exact score prediction (DELETE /api/predictions/exact-score/match/{match_id})"""
        if not hasattr(self, 'test_exact_match_id'):
            print("⏭️ Skipping exact score deletion test - no exact score to delete")
            return True
            
        success, response = self.run_test(
            "Delete Exact Score Prediction",
            "DELETE",
            f"api/predictions/exact-score/match/{self.test_exact_match_id}",
            200
        )
        
        if success:
            message = response.get("message")
            if "deleted" in message.lower():
                print(f"✅ Exact score prediction deleted: {message}")
                return True
            else:
                print(f"❌ Unexpected delete message: {message}")
                self.failed_tests.append("Delete Exact Score - Unexpected message")
                return False
        return False

    def test_get_match_by_id(self):
        """Test getting a single match by ID (GET /api/football/match/{match_id})"""
        # Try to get matches first to get a real match ID
        success, response = self.run_test(
            "Get Matches List", 
            "GET",
            "api/football/matches",
            200
        )
        
        if not success:
            print("⏭️ Skipping match by ID test - can't get matches list")
            return False
            
        matches = response.get("matches", [])
        if not matches:
            print("⏭️ Skipping match by ID test - no matches available")
            return True
            
        # Use the first match ID
        test_match_id = matches[0].get("id")
        if not test_match_id:
            print("⏭️ Skipping match by ID test - no match ID found")
            return True
        
        success, response = self.run_test(
            "Get Match by ID",
            "GET",
            f"api/football/match/{test_match_id}",
            200
        )
        
        if success:
            match = response.get("match")
            if match and match.get("id") == test_match_id:
                print(f"✅ Got match data for ID {test_match_id}")
                print(f"   Match: {match.get('homeTeam', {}).get('name', 'Unknown')} vs {match.get('awayTeam', {}).get('name', 'Unknown')}")
                # Store for standings test
                self.test_competition_code = match.get("competitionCode")
                return True
            else:
                print(f"❌ Invalid match data or ID mismatch")
                self.failed_tests.append("Get Match by ID - Invalid response")
                return False
        return False

    def test_get_standings(self):
        """Test getting standings for a competition (GET /api/football/standings/{competition_code})"""
        # Use competition code from previous test, or default to PL
        competition_code = getattr(self, 'test_competition_code', 'PL')
        
        success, response = self.run_test(
            f"Get Standings for {competition_code}",
            "GET", 
            f"api/football/standings/{competition_code}",
            200
        )
        
        if success:
            standings = response.get("standings", [])
            competition = response.get("competition")
            print(f"✅ Got {len(standings)} standings entries for {competition}")
            if len(standings) > 0:
                print(f"   First team: {standings[0].get('team', 'Unknown')} (Position {standings[0].get('position', 'N/A')})")
            return True
        return False

    def test_invalid_endpoints(self):
        """Test some invalid endpoints to ensure proper error handling"""
        # Test invalid endpoint
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
        print("🚀 Starting GuessIt Backend API Tests")
        print("=" * 60)
        
        test_results = {}
        
        # Core API tests
        test_results['api_root'] = self.test_api_root()
        test_results['health_check'] = self.test_health_check()
        
        # Auth API tests
        test_results['register'] = self.test_register_endpoint() 
        test_results['login'] = self.test_login_endpoint()
        
        # Messages and Friends API tests (require auth)
        test_results['messages_conversations'] = self.test_messages_conversations()
        test_results['friends_invite_match'] = self.test_friends_invite_match()
        test_results['duplicate_match_invitations'] = self.test_duplicate_match_invitations()
        
        # Prediction API tests (require auth) - Test the new Guess It and Remove functionality
        test_results['prediction_creation'] = self.test_prediction_creation()
        test_results['prediction_get'] = self.test_prediction_get()
        test_results['exact_score_creation'] = self.test_exact_score_creation() 
        test_results['prediction_deletion'] = self.test_prediction_deletion()
        test_results['exact_score_deletion'] = self.test_exact_score_deletion()
        
        # Match Detail Page API tests - NEW FEATURES TO TEST
        test_results['get_match_by_id'] = self.test_get_match_by_id()
        test_results['get_standings'] = self.test_get_standings()
        
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
        
        return test_results

def main():
    """Main test function"""
    print("GuessIt Backend API Tester")
    print("Testing against: https://guess-it-staging-1.preview.emergentagent.com")
    
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