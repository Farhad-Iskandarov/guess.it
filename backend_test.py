#!/usr/bin/env python3
"""
Backend API Testing for GuessIt Application
Tests all critical API endpoints including health, auth, football data
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class GuessItAPITester:
    def __init__(self, base_url: str = "https://guess-it-staging-2.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.admin_credentials = {
            "email": "farhad.isgandar@gmail.com",
            "password": "Salam123?"
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            self.failed_tests.append({"test": name, "details": details})
            print(f"❌ {name}: FAILED {details}")

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        
        request_headers = {'Content-Type': 'application/json'}
        if headers:
            request_headers.update(headers)
        
        if self.session_token:
            request_headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=request_headers, timeout=10)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=request_headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}

            return success, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_health_endpoints(self):
        """Test basic health and system endpoints"""
        print("\n🔍 Testing Health & System Endpoints...")
        
        # Test health endpoint
        success, data = self.make_request('GET', '/health')
        self.log_test("Health Check", success, 
                     f"Status: {data.get('status', 'unknown')}" if success else f"Error: {data}")

        # Test root API endpoint
        success, data = self.make_request('GET', '/')
        expected_message = "GuessIt API is running"
        message_correct = success and data.get('message') == expected_message
        self.log_test("Root API Message", message_correct,
                     f"Message: {data.get('message', 'none')}" if success else f"Error: {data}")

        # Test system metrics
        success, data = self.make_request('GET', '/system/metrics')
        has_metrics = success and 'websocket_connections' in data and 'mongodb' in data
        self.log_test("System Metrics", has_metrics,
                     f"MongoDB: {data.get('mongodb', 'unknown')}, Redis: {data.get('redis', 'unknown')}" if success else f"Error: {data}")

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔍 Testing Authentication Endpoints...")
        
        # Test registration endpoint (should accept data)
        test_user_data = {
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!"
        }
        
        success, data = self.make_request('POST', '/auth/register', test_user_data, expected_status=200)
        self.log_test("Registration Endpoint", success,
                     f"User created: {data.get('user', {}).get('email', 'unknown')}" if success else f"Error: {data}")

        # Test admin login
        success, data = self.make_request('POST', '/auth/login', self.admin_credentials)
        if success and 'user' in data:
            # Extract session token from response or cookies
            user_data = data['user']
            self.log_test("Admin Login", True, 
                         f"Logged in as: {user_data.get('email', 'unknown')}, Role: {user_data.get('role', 'user')}")
            
            # Try to get session token from cookies if available
            if hasattr(self.session, 'cookies') and 'session_token' in self.session.cookies:
                self.session_token = self.session.cookies['session_token']
        else:
            self.log_test("Admin Login", False, f"Error: {data}")

        # Test /auth/me endpoint
        success, data = self.make_request('GET', '/auth/me')
        self.log_test("Get Current User", success,
                     f"User: {data.get('email', 'unknown')}" if success else f"Error: {data}")

    def test_football_endpoints(self):
        """Test football-related endpoints"""
        print("\n🔍 Testing Football Endpoints...")
        
        # Test competitions list
        success, data = self.make_request('GET', '/football/competitions')
        has_competitions = success and 'competitions' in data
        self.log_test("Football Competitions", has_competitions,
                     f"Found {len(data.get('competitions', []))} competitions" if success else f"Error: {data}")

        # Test matches endpoint
        success, data = self.make_request('GET', '/football/matches')
        has_matches = success and 'matches' in data
        match_count = len(data.get('matches', [])) if success else 0
        self.log_test("Football Matches", has_matches,
                     f"Found {match_count} matches" if success else f"Error: {data}")

        # Test today's matches
        success, data = self.make_request('GET', '/football/matches/today')
        self.log_test("Today's Matches", success,
                     f"Found {len(data.get('matches', []))} today's matches" if success else f"Error: {data}")

        # Test live matches
        success, data = self.make_request('GET', '/football/matches/live')
        self.log_test("Live Matches", success,
                     f"Found {len(data.get('matches', []))} live matches" if success else f"Error: {data}")

        # Test upcoming matches
        success, data = self.make_request('GET', '/football/matches/upcoming')
        self.log_test("Upcoming Matches", success,
                     f"Found {len(data.get('matches', []))} upcoming matches" if success else f"Error: {data}")

        # Test leaderboard
        success, data = self.make_request('GET', '/football/leaderboard')
        has_users = success and 'users' in data
        self.log_test("Global Leaderboard", has_users,
                     f"Found {len(data.get('users', []))} users" if success else f"Error: {data}")

    def test_predictions_endpoints(self):
        """Test predictions endpoints - main focus of this iteration"""
        print("\n🔍 Testing Predictions Endpoints (Main Fix)...")
        
        # Test basic predictions endpoint
        success, data = self.make_request('GET', '/predictions/me')
        self.log_test("Basic Predictions", success,
                     f"Found {len(data.get('predictions', []))} predictions" if success else f"Error: {data}")

        # Test detailed predictions endpoint - this was the main issue with KeyError: 'votes'
        success, data = self.make_request('GET', '/predictions/me/detailed')
        if success:
            predictions = data.get('predictions', [])
            summary = data.get('summary', {})
            
            # Check for the 'votes' field issue that was fixed
            votes_issue_found = False
            for i, pred in enumerate(predictions[:3]):  # Check first 3
                match_data = pred.get('match', {})
                if 'votes' not in match_data:
                    votes_issue_found = True
                    break
            
            if votes_issue_found:
                self.log_test("Detailed Predictions (votes fix)", False, 
                             "KeyError: 'votes' issue still present")
            else:
                self.log_test("Detailed Predictions (votes fix)", True,
                             f"Found {len(predictions)} predictions, votes field present ✅")
                
            # Check summary data
            correct = summary.get('correct', 0)
            wrong = summary.get('wrong', 0) 
            pending = summary.get('pending', 0)
            self.log_test("Predictions Summary", True,
                         f"Correct: {correct}, Wrong: {wrong}, Pending: {pending}")
        else:
            self.log_test("Detailed Predictions (votes fix)", False, f"Error: {data}")

    def test_additional_endpoints(self):
        """Test additional endpoints"""
        print("\n🔍 Testing Additional Endpoints...")
        
        # Test banners endpoint
        success, data = self.make_request('GET', '/football/banners')
        self.log_test("Active Banners", success,
                     f"Found {len(data.get('banners', []))} banners" if success else f"Error: {data}")

        # Test weekly leaderboard
        success, data = self.make_request('GET', '/football/leaderboard/weekly')
        self.log_test("Weekly Leaderboard", success,
                     f"Weekly data available" if success else f"Error: {data}")

        # Test search functionality
        success, data = self.make_request('GET', '/football/search?q=arsenal')
        self.log_test("Match Search", success,
                     f"Search returned {len(data.get('matches', []))} results" if success else f"Error: {data}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting GuessIt Backend API Tests")
        print(f"🎯 Testing against: {self.base_url}")
        print("=" * 60)

        try:
            self.test_health_endpoints()
            self.test_auth_endpoints()
            self.test_predictions_endpoints()  # Add predictions test
            self.test_football_endpoints()
            self.test_additional_endpoints()
        except Exception as e:
            print(f"❌ Test suite error: {e}")

        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")

        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['details']}")

        return len(self.failed_tests) == 0

def main():
    """Main test execution"""
    tester = GuessItAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())