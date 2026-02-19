#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-duplicate.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, passed, details="", response_data=None):
        """Log test results"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            
        result = {
            "name": name,
            "passed": passed,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if not passed and response_data:
            print(f"    Response: {response_data}")
        print()

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Prepare headers
        request_headers = {'Content-Type': 'application/json'}
        if headers:
            request_headers.update(headers)
        if auth_required and self.session_token:
            request_headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=request_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=request_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=request_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=request_headers, timeout=10)
            else:
                self.log_test(name, False, f"Unsupported HTTP method: {method}")
                return False, {}

            # Check status code
            success = response.status_code == expected_status
            
            # Try to parse JSON response
            try:
                response_json = response.json()
            except:
                response_json = {"raw_text": response.text[:200]}

            if success:
                self.log_test(name, True, f"Status: {response.status_code}", response_json)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}", response_json)

            return success, response_json

        except requests.exceptions.Timeout:
            self.log_test(name, False, "Request timed out")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log_test(name, False, "Connection error - backend may be down")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_endpoint(self):
        """Test health check endpoint"""
        return self.run_test(
            "Health Check Endpoint",
            "GET",
            "/api/health",
            200
        )

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET", 
            "/api/",
            200
        )

    def test_auth_register(self):
        """Test user registration"""
        test_email = f"test_{int(time.time())}@example.com"
        test_password = "TestPass123!"
        
        success, response = self.run_test(
            "Auth Register Endpoint",
            "POST",
            "/api/auth/register",
            200,
            data={
                "email": test_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        # Store user info for subsequent tests
        if success and response.get("user"):
            self.user_id = response["user"].get("user_id")
            # For registration, session might be set via cookie, try to extract from response
            
        return success, response

    def test_auth_login(self):
        """Test user login with registered user"""
        # First register a new user
        test_email = f"login_test_{int(time.time())}@example.com"
        test_password = "LoginTest123!"
        
        # Register user first
        reg_success, reg_response = self.run_test(
            "Auth Register for Login Test",
            "POST",
            "/api/auth/register",
            200,
            data={
                "email": test_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        if not reg_success:
            self.log_test("Auth Login Endpoint", False, "Could not register user for login test")
            return False, {}
        
        # Now try to login with the same credentials
        success, response = self.run_test(
            "Auth Login Endpoint",
            "POST",
            "/api/auth/login", 
            200,
            data={
                "email": test_email,
                "password": test_password
            }
        )
        
        return success, response

    def test_auth_login_invalid(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Auth Login - Invalid Credentials",
            "POST",
            "/api/auth/login",
            401,
            data={
                "email": "invalid@example.com",
                "password": "wrongpassword"
            }
        )
        return success, response

    def test_auth_me_without_auth(self):
        """Test /me endpoint without authentication"""
        success, response = self.run_test(
            "Auth Me - No Auth Token",
            "GET",
            "/api/auth/me",
            401
        )
        return success, response

    def test_auth_logout(self):
        """Test logout endpoint"""
        success, response = self.run_test(
            "Auth Logout Endpoint",
            "POST",
            "/api/auth/logout",
            200
        )
        return success, response

    def test_predictions_without_auth(self):
        """Test predictions endpoint without authentication"""
        success, response = self.run_test(
            "Predictions - No Auth",
            "POST",
            "/api/predictions",
            401,
            data={
                "match_id": 12345,
                "prediction": "home"
            }
        )
        return success, response

    def test_predictions_me_without_auth(self):
        """Test get my predictions without auth"""
        success, response = self.run_test(
            "Predictions Me - No Auth",
            "GET",
            "/api/predictions/me",
            401
        )
        return success, response
    
    def test_predictions_detailed_without_auth(self):
        """Test GET /api/predictions/me/detailed without authentication"""
        success, response = self.run_test(
            "Predictions Me Detailed - No Auth",
            "GET",
            "/api/predictions/me/detailed",
            401
        )
        return success, response
    
    def test_prediction_delete_without_auth(self):
        """Test DELETE /api/predictions/match/{id} without authentication"""
        success, response = self.run_test(
            "Delete Prediction - No Auth",
            "DELETE",
            "/api/predictions/match/12345",
            401
        )
        return success, response
    
    def test_auth_with_test_credentials(self):
        """Test authentication with test credentials: testpred@test.com"""
        success, response = self.run_test(
            "Auth Login - Test Credentials",
            "POST",
            "/api/auth/login",
            200,
            data={
                "email": "testpred@test.com",
                "password": "Test1234!"
            }
        )
        
        if success:
            # Store session token if available - try different keys
            if 'access_token' in response:
                self.session_token = response['access_token']
                self.log_test("Token Extraction", True, "Found access_token")
            elif 'token' in response:
                self.session_token = response['token']  
                self.log_test("Token Extraction", True, "Found token")
            elif 'session_token' in response:
                self.session_token = response['session_token']
                self.log_test("Token Extraction", True, "Found session_token")
            else:
                # Session might be cookie-based, let's try to use session for authenticated requests
                self.log_test("Token Extraction", False, f"No token found in response keys: {list(response.keys())}")
                
        return success, response
    
    def test_predictions_me_detailed_with_auth(self):
        """Test GET /api/predictions/me/detailed with authentication using cookies"""
        # Try cookie-based authentication first
        url = f"{self.base_url}/api/predictions/me/detailed"
        headers = {'Content-Type': 'application/json'}
        
        # Create a session to maintain cookies
        session = requests.Session()
        
        # First login to get session cookie
        login_url = f"{self.base_url}/api/auth/login"
        login_response = session.post(login_url, json={
            "email": "testpred@test.com", 
            "password": "Test1234!"
        }, headers=headers, timeout=10)
        
        if login_response.status_code != 200:
            self.log_test("Predictions Me Detailed - With Auth", False, f"Login failed: {login_response.status_code}")
            return False, {}
        
        # Now try the detailed endpoint with session cookies
        try:
            response = session.get(url, headers=headers, timeout=10)
            
            success = response.status_code == 200
            
            try:
                response_json = response.json()
            except:
                response_json = {"raw_text": response.text[:200]}
            
            if success:
                # Validate response structure
                expected_keys = ['predictions', 'total', 'summary']
                missing_keys = [key for key in expected_keys if key not in response_json]
                if missing_keys:
                    self.log_test("Predictions Me Detailed - With Auth", False, f"Missing keys: {missing_keys}", response_json)
                    return False, response_json
                
                # Check summary structure
                if 'summary' in response_json:
                    summary_keys = ['correct', 'wrong', 'pending']
                    missing_summary_keys = [key for key in summary_keys if key not in response_json['summary']]
                    if missing_summary_keys:
                        self.log_test("Predictions Me Detailed - With Auth", False, f"Missing summary keys: {missing_summary_keys}", response_json)
                        return False, response_json
                
                self.log_test("Predictions Me Detailed - With Auth", True, f"Status: {response.status_code}, Found {len(response_json.get('predictions', []))} predictions", response_json)
            else:
                self.log_test("Predictions Me Detailed - With Auth", False, f"Expected 200, got {response.status_code}", response_json)
            
            return success, response_json
            
        except Exception as e:
            self.log_test("Predictions Me Detailed - With Auth", False, f"Exception: {str(e)}")
            return False, {}

    def test_full_prediction_workflow_bug_fix(self):
        """
        Test the specific bug fix: Register user → Login → Make prediction → Check /api/predictions/me/detailed 
        returns match data (not null) for predicted matches
        """
        print("🐛 Testing Bug Fix: My Predictions Match Data")
        
        # Create a session to maintain cookies
        session = requests.Session()
        headers = {'Content-Type': 'application/json'}
        
        # Step 1: Register a new user
        test_email = f"bugfix_test_{int(time.time())}@example.com"
        test_password = "BugFixTest123!"
        
        print(f"1️⃣ Registering user: {test_email}")
        register_response = session.post(f"{self.base_url}/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "confirm_password": test_password,
            "name": "Bug Fix Tester"
        }, headers=headers, timeout=10)
        
        if register_response.status_code != 200:
            self.log_test("Bug Fix Test - Register", False, f"Registration failed: {register_response.status_code}")
            return False
        
        print(f"✅ User registered successfully")
        
        # Step 2: Login with the new user
        print(f"2️⃣ Logging in user: {test_email}")
        login_response = session.post(f"{self.base_url}/api/auth/login", json={
            "email": test_email,
            "password": test_password
        }, headers=headers, timeout=10)
        
        if login_response.status_code != 200:
            self.log_test("Bug Fix Test - Login", False, f"Login failed: {login_response.status_code}")
            return False
            
        print(f"✅ User logged in successfully")
        
        # Step 3: Get available matches to predict on
        print(f"3️⃣ Fetching available matches...")
        matches_response = session.get(f"{self.base_url}/api/football/matches", headers=headers, timeout=15)
        
        if matches_response.status_code != 200:
            self.log_test("Bug Fix Test - Get Matches", False, f"Failed to get matches: {matches_response.status_code}")
            return False
        
        try:
            matches_data = matches_response.json()
            matches = matches_data.get('matches', [])
            
            if not matches:
                self.log_test("Bug Fix Test - No Matches", False, "No matches available to predict on")
                return False
                
            # Get the first available match
            test_match = matches[0]
            match_id = test_match['id']
            print(f"✅ Found {len(matches)} matches. Using match ID: {match_id} ({test_match.get('homeTeam', {}).get('name', 'Unknown')} vs {test_match.get('awayTeam', {}).get('name', 'Unknown')})")
            
        except Exception as e:
            self.log_test("Bug Fix Test - Parse Matches", False, f"Failed to parse matches: {str(e)}")
            return False
        
        # Step 4: Make a prediction on this match
        print(f"4️⃣ Making prediction on match {match_id}...")
        prediction_response = session.post(f"{self.base_url}/api/predictions", json={
            "match_id": match_id,
            "prediction": "home"
        }, headers=headers, timeout=10)
        
        if prediction_response.status_code not in [200, 201]:
            self.log_test("Bug Fix Test - Make Prediction", False, f"Failed to make prediction: {prediction_response.status_code}")
            return False
            
        print(f"✅ Prediction made successfully")
        
        # Step 5: Test /api/predictions/me/detailed to ensure it returns match data
        print(f"5️⃣ Testing /api/predictions/me/detailed endpoint...")
        detailed_response = session.get(f"{self.base_url}/api/predictions/me/detailed", headers=headers, timeout=15)
        
        if detailed_response.status_code != 200:
            self.log_test("Bug Fix Test - Detailed Predictions", False, f"Failed to get detailed predictions: {detailed_response.status_code}")
            return False
        
        try:
            detailed_data = detailed_response.json()
            predictions = detailed_data.get('predictions', [])
            
            if not predictions:
                self.log_test("Bug Fix Test - No Predictions", False, "No predictions returned from detailed endpoint")
                return False
            
            # Check if our prediction is there and has match data
            found_prediction = None
            for pred in predictions:
                if pred.get('match_id') == match_id:
                    found_prediction = pred
                    break
            
            if not found_prediction:
                self.log_test("Bug Fix Test - Prediction Not Found", False, f"Prediction for match {match_id} not found in detailed response")
                return False
            
            # THE CORE BUG FIX TEST: Check if match data is present (not null)
            match_data = found_prediction.get('match')
            
            if match_data is None:
                self.log_test("🐛 BUG STILL EXISTS", False, f"Match data is null for match ID {match_id} - the bug fix didn't work!")
                return False
            
            # Validate match data structure
            required_match_fields = ['homeTeam', 'awayTeam', 'competition', 'dateTime', 'status', 'score']
            missing_fields = [field for field in required_match_fields if field not in match_data]
            
            if missing_fields:
                self.log_test("Bug Fix Test - Incomplete Match Data", False, f"Match data missing fields: {missing_fields}")
                return False
            
            # Success! The bug fix is working
            home_team = match_data.get('homeTeam', {}).get('name', 'Unknown')
            away_team = match_data.get('awayTeam', {}).get('name', 'Unknown')
            competition = match_data.get('competition', 'Unknown')
            
            self.log_test("🎉 BUG FIX VERIFIED", True, f"Match data properly returned! {home_team} vs {away_team} in {competition}")
            print(f"✅ Match data includes: teams, competition, datetime, status, score")
            print(f"✅ No more 'Match data unavailable' messages!")
            
            return True
            
        except Exception as e:
            self.log_test("Bug Fix Test - Parse Response", False, f"Failed to parse detailed response: {str(e)}")
            return False

    def test_football_matches(self):
        """Test football matches endpoint"""
        success, response = self.run_test(
            "Football Matches Endpoint",
            "GET",
            "/api/football/matches",
            200
        )
        
        # Note: This might return empty data due to placeholder API key, but endpoint should exist
        return success, response

    def test_football_competitions(self):
        """Test football competitions endpoint"""
        success, response = self.run_test(
            "Football Competitions Endpoint",
            "GET",
            "/api/football/competitions",
            200
        )
        return success, response

    def test_football_matches_today(self):
        """Test today's matches endpoint"""
        success, response = self.run_test(
            "Football Today Matches",
            "GET",
            "/api/football/matches/today",
            200
        )
        return success, response

    def test_football_matches_live(self):
        """Test live matches endpoint"""
        success, response = self.run_test(
            "Football Live Matches",
            "GET",
            "/api/football/matches/live",
            200
        )
        return success, response

    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("🚀 GuessIt Backend API Testing")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        print()

        # Basic endpoints
        print("📌 Testing Basic Endpoints...")
        self.test_health_endpoint()
        self.test_root_endpoint()

        # Auth endpoints  
        print("📌 Testing Authentication Endpoints...")
        self.test_auth_register()
        self.test_auth_login()
        self.test_auth_login_invalid()
        self.test_auth_me_without_auth()
        self.test_auth_logout()

        # Predictions endpoints (without auth)
        print("📌 Testing Predictions Endpoints...")
        self.test_predictions_without_auth()
        self.test_predictions_me_without_auth()
        self.test_predictions_detailed_without_auth()
        self.test_prediction_delete_without_auth()
        
        # Test the specific bug fix scenario
        print("📌 Testing My Predictions Bug Fix...")
        bug_fix_success = self.test_full_prediction_workflow_bug_fix()
        if not bug_fix_success:
            print("❌ Bug fix test failed - core functionality may be broken")
        
        # Test with authenticated user (if exists)
        print("📌 Testing My Predictions Feature (legacy test)...")
        auth_success, auth_response = self.test_auth_with_test_credentials()
        if auth_success:
            self.test_predictions_me_detailed_with_auth()
        else:
            # This is expected for fresh deployments
            print("ℹ️  Predefined test user not found (expected for fresh deployment)")

        # Football endpoints
        print("📌 Testing Football Endpoints...")
        self.test_football_matches()
        self.test_football_competitions() 
        self.test_football_matches_today()
        self.test_football_matches_live()

        # Print summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t["passed"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  • {test['name']}: {test['details']}")
        
        print("=" * 60)
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = GuessItAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test runner error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())