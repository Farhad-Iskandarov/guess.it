#!/usr/bin/env python3
"""
Backend API Testing for GuessIt Football Prediction Platform
Tests all authentication and prediction endpoints.
"""

import requests
import sys
import json
from datetime import datetime


class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-copy.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_data = None

    def log(self, message, success=None):
        """Log test results with emoji indicators"""
        if success is True:
            print(f"✅ {message}")
        elif success is False:
            print(f"❌ {message}")
        else:
            print(f"🔍 {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"Passed - Status: {response.status_code}", True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                self.log(f"Failed - Expected {expected_status}, got {response.status_code}", False)
                try:
                    error_data = response.json()
                    self.log(f"Error response: {error_data}")
                except:
                    self.log(f"Error response: {response.text}")
                return False, {}

        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", False)
            return False, {}

    def test_health_endpoint(self):
        """Test API health endpoint"""
        success, response = self.run_test(
            "API Health Check",
            "GET",
            "/health",
            200
        )
        if success and isinstance(response, dict):
            self.log(f"Health response: {response}")
        return success

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        test_password = "TestPass123!"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "/auth/register",
            200,
            data={
                "email": test_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        if success:
            self.user_data = response
            self.log(f"Registered user: {test_email}")
            # Extract session from response if available
            if 'user' in response:
                self.log(f"User ID: {response['user'].get('user_id', 'N/A')}")
                self.log(f"Requires nickname: {response.get('requires_nickname', False)}")
        
        return success, test_email, test_password

    def test_user_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "/auth/login",
            200,
            data={
                "email": email,
                "password": password
            }
        )
        
        if success:
            self.user_data = response
            self.log(f"Login successful for: {email}")
            if 'user' in response:
                self.log(f"User ID: {response['user'].get('user_id', 'N/A')}")
        
        return success

    def test_me_endpoint_unauthenticated(self):
        """Test /me endpoint without authentication - should return 401"""
        success, response = self.run_test(
            "Me Endpoint (Unauthenticated)",
            "GET",
            "/auth/me",
            401
        )
        return success

    def test_nickname_check(self):
        """Test nickname availability check"""
        test_nickname = f"testuser_{datetime.now().strftime('%H%M%S')}"
        
        success, response = self.run_test(
            "Nickname Availability Check",
            "GET",
            f"/auth/nickname/check?nickname={test_nickname}",
            200
        )
        
        if success and isinstance(response, dict):
            self.log(f"Nickname '{test_nickname}' available: {response.get('available', False)}")
            self.log(f"Message: {response.get('message', 'N/A')}")
        
        return success

    def test_predictions_unauthenticated(self):
        """Test predictions endpoint without authentication - should require auth"""
        success, response = self.run_test(
            "Predictions (Unauthenticated)",
            "POST",
            "/predictions",
            401,
            data={
                "match_id": 1,
                "prediction": "home"
            }
        )
        return success

    def test_football_competitions(self):
        """Test football competitions endpoint"""
        success, response = self.run_test(
            "Football Competitions",
            "GET",
            "/football/competitions",
            200
        )
        
        if success and isinstance(response, dict):
            competitions = response.get('competitions', [])
            self.log(f"Found {len(competitions)} competitions")
            if competitions:
                # Check if we have expected competition codes
                codes = [comp.get('code') for comp in competitions]
                expected_codes = ['PL', 'CL', 'SA', 'PD', 'BL1', 'FL1']
                found_codes = [code for code in expected_codes if code in codes]
                self.log(f"Expected competition codes found: {found_codes}")
        
        return success

    def test_football_matches(self):
        """Test football matches endpoint with real Football-Data.org data"""
        success, response = self.run_test(
            "Football Matches (General)",
            "GET",
            "/football/matches",
            200
        )
        
        if success and isinstance(response, dict):
            matches = response.get('matches', [])
            total = response.get('total', 0)
            self.log(f"Found {total} matches")
            
            if matches:
                # Check first match structure
                match = matches[0]
                required_fields = ['id', 'homeTeam', 'awayTeam', 'competition', 'status', 'dateTime', 'predictionLocked']
                missing_fields = [field for field in required_fields if field not in match]
                
                if missing_fields:
                    self.log(f"Missing required fields: {missing_fields}", False)
                    return False
                else:
                    self.log("Match data structure is correct")
                    
                # Check team data structure
                home_team = match.get('homeTeam', {})
                if 'name' in home_team and 'crest' in home_team:
                    self.log("Team data includes name and crest")
                else:
                    self.log("Missing team name or crest data", False)
                
                # Check if we have live matches
                live_matches = [m for m in matches if m.get('status') == 'LIVE']
                self.log(f"Live matches found: {len(live_matches)}")
                
                # NEW: Check matchMinute field for live matches
                for live_match in live_matches:
                    match_minute = live_match.get('matchMinute')
                    if match_minute:
                        self.log(f"✅ LIVE match has matchMinute: {match_minute}")
                    else:
                        self.log(f"❌ LIVE match missing matchMinute field", False)
                
                # Check NOT_STARTED matches don't have matchMinute
                not_started_matches = [m for m in matches if m.get('status') == 'NOT_STARTED']
                for ns_match in not_started_matches[:3]:  # Check first 3 only
                    match_minute = ns_match.get('matchMinute')
                    if match_minute is None:
                        self.log(f"✅ NOT_STARTED match correctly has no matchMinute")
                    else:
                        self.log(f"❌ NOT_STARTED match incorrectly has matchMinute: {match_minute}", False)
                
                # Check if prediction locking works
                locked_matches = [m for m in matches if m.get('predictionLocked')]
                self.log(f"Prediction locked matches: {len(locked_matches)}")
        
        return success

    def test_football_live_matches(self):
        """Test live football matches endpoint"""
        success, response = self.run_test(
            "Football Live Matches",
            "GET", 
            "/football/matches/live",
            200
        )
        
        if success and isinstance(response, dict):
            matches = response.get('matches', [])
            total = response.get('total', 0)
            self.log(f"Found {total} live matches")
            
            # All returned matches should have status='LIVE'
            if matches:
                non_live = [m for m in matches if m.get('status') != 'LIVE']
                if non_live:
                    self.log(f"Found {len(non_live)} non-live matches in live endpoint", False)
                    return False
                else:
                    self.log("All matches have status='LIVE'")
                    
                # Check if live matches have predictionLocked=true
                unlocked_live = [m for m in matches if not m.get('predictionLocked')]
                if unlocked_live:
                    self.log(f"Found {len(unlocked_live)} unlocked live matches", False)
                else:
                    self.log("All live matches have predictionLocked=true")
                
                # NEW: Check if live matches have matchMinute field
                for match in matches:
                    if match.get('status') == 'LIVE':
                        match_minute = match.get('matchMinute')
                        if match_minute:
                            self.log(f"LIVE match {match.get('id')} has matchMinute: {match_minute}")
                        else:
                            self.log(f"LIVE match {match.get('id')} missing matchMinute field", False)
        
        return success

    def test_football_competition_matches(self):
        """Test competition-specific matches endpoint"""
        # Test Champions League matches
        success, response = self.run_test(
            "Football Competition Matches (UCL)",
            "GET",
            "/football/matches/competition/CL",
            200
        )
        
        if success and isinstance(response, dict):
            matches = response.get('matches', [])
            total = response.get('total', 0)
            self.log(f"Found {total} Champions League matches")
            
            if matches:
                # Check if all matches are from Champions League
                non_cl_matches = [m for m in matches if 'Champions League' not in m.get('competition', '')]
                if len(non_cl_matches) > 0:
                    self.log(f"Found {len(non_cl_matches)} non-Champions League matches", False)
                else:
                    self.log("All matches are from Champions League")
        
        return success

    def test_invalid_endpoints(self):
        """Test some invalid endpoints to verify proper error handling"""
        success, response = self.run_test(
            "Invalid Endpoint",
            "GET",
            "/invalid/endpoint",
            404
        )
        return success

    def test_global_search(self):
        """Test the global search functionality"""
        self.log("=== Testing Global Search Feature ===")
        
        # Test 1: Search with valid team name (2+ characters)
        success1, response1 = self.run_test(
            "Search for 'Liverpool' (min 2 chars)",
            "GET",
            "/football/search",
            200,
            params={"q": "Liverpool"}
        )
        
        if success1 and isinstance(response1, dict):
            matches = response1.get('matches', [])
            self.log(f"Liverpool search found {len(matches)} matches")
            
            # Check if results are LIVE or NOT_STARTED only
            invalid_status = [m for m in matches if m.get('status') not in ['LIVE', 'NOT_STARTED']]
            if invalid_status:
                self.log(f"Found {len(invalid_status)} matches with invalid status (should be LIVE/NOT_STARTED only)", False)
            else:
                self.log("All search results have correct status (LIVE/NOT_STARTED)")

        # Test 2: Search with Milan
        success2, response2 = self.run_test(
            "Search for 'Milan'",
            "GET",
            "/football/search",
            200,
            params={"q": "Milan"}
        )
        
        if success2 and isinstance(response2, dict):
            matches = response2.get('matches', [])
            self.log(f"Milan search found {len(matches)} matches")

        # Test 3: Case insensitive search
        success3, response3 = self.run_test(
            "Search case-insensitive 'liverpool' (lowercase)",
            "GET",
            "/football/search",
            200,
            params={"q": "liverpool"}
        )

        # Test 4: Short query (1 character - should fail validation)
        success4, _ = self.run_test(
            "Search with 1 character 'L' (should fail validation)",
            "GET",
            "/football/search",
            422,  # FastAPI validation error for min_length=2
            params={"q": "L"}
        )

        # Test 5: Non-existent team (should return empty results)
        success5, response5 = self.run_test(
            "Search for non-existent team 'XYZTeamNotExists'",
            "GET",
            "/football/search",
            200,
            params={"q": "XYZTeamNotExists"}
        )

        if success5 and isinstance(response5, dict):
            matches = response5.get('matches', [])
            if len(matches) == 0:
                self.log("Non-existent team correctly returns empty results")
            else:
                self.log(f"Expected empty results but got {len(matches)} matches", False)

        # Test 6: Max results (check if limited to 10)
        success6, response6 = self.run_test(
            "Search for common term 'FC' (check max 10 results)",
            "GET",
            "/football/search",
            200,
            params={"q": "FC"}
        )

        if success6 and isinstance(response6, dict):
            matches = response6.get('matches', [])
            if len(matches) <= 10:
                self.log(f"Results limited correctly: {len(matches)} matches (≤10)")
            else:
                self.log(f"Too many results: {len(matches)} matches (should be ≤10)", False)

        # Check search feature structure
        if success1 and response1.get('matches'):
            sample_match = response1['matches'][0]
            required_fields = ['id', 'homeTeam', 'awayTeam', 'competition', 'status', 'dateTime', 'score', 'votes']
            missing_fields = [field for field in required_fields if field not in sample_match]
            
            if missing_fields:
                self.log(f"Search result missing required fields: {missing_fields}", False)
            else:
                self.log("Search result structure is correct")

        search_tests = [success1, success2, success3, success4, success5, success6]
        search_passed = sum(1 for s in search_tests if s)
        self.log(f"Global search tests passed: {search_passed}/{len(search_tests)}")
        
        return all(search_tests)
    def run_all_tests(self):
        """Run all API tests"""
        self.log("=== GuessIt API Testing Started ===")
        self.log(f"Testing API at: {self.base_url}")
        print()
        
        # Test 1: Health Check
        self.test_health_endpoint()
        print()
        
        # Test 2: Me endpoint without auth (should fail)
        self.test_me_endpoint_unauthenticated()
        print()
        
        # Test 3: Nickname check
        self.test_nickname_check()
        print()
        
        # Test 4: Football API - Competitions
        self.test_football_competitions()
        print()
        
        # Test 5: Football API - General matches
        self.test_football_matches()
        print()
        
        # Test 6: Football API - Live matches
        self.test_football_live_matches()
        print()
        
        # Test 7: Football API - Competition matches
        self.test_football_competition_matches()
        print()
        
        # Test 8: Predictions without auth (should fail)
        self.test_predictions_unauthenticated()
        print()
        
        # Test 9: User registration
        reg_success, email, password = self.test_user_registration()
        print()
        
        # Test 10: User login (if registration succeeded)
        if reg_success:
            self.test_user_login(email, password)
            print()
        
        # Test 11: Global Search Functionality (NEW)
        self.test_global_search()
        print()
        
        # Test 12: Invalid endpoint
        self.test_invalid_endpoints()
        print()
        
        # Final Results
        self.log("=== TEST SUMMARY ===")
        self.log(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        self.log(f"Success rate: {success_rate:.1f}%")
        
        # Return exit code
        if self.tests_passed == self.tests_run:
            self.log("All tests passed! ✨", True)
            return 0
        else:
            self.log(f"Some tests failed. Check logs above.", False)
            return 1


def main():
    """Main test execution"""
    tester = GuessItAPITester()
    return tester.run_all_tests()


if __name__ == "__main__":
    sys.exit(main())