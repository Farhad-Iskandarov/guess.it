#!/usr/bin/env python3

"""
GuessIt Backend API Testing Suite
Tests all major API endpoints and functionality
"""

import requests
import sys
import os
from datetime import datetime
import json
from typing import Dict, Any, Optional

class GuessItAPITester:
    def __init__(self, base_url: str = "https://guess-it-enhanced.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.nickname = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()
        
        # Test data
        self.test_email = f"testapi_{datetime.now().strftime('%H%M%S')}@guessit.com"
        self.test_password = "TestPass123!"
        self.test_nickname = f"testuser_{datetime.now().strftime('%H%M%S')}"

    def run_test(self, name: str, method: str, endpoint: str, 
                 expected_status: int, data: Optional[Dict] = None,
                 headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}" if not endpoint.startswith('/') else f"{self.base_url}{endpoint}"
        
        # Default headers
        req_headers = {'Content-Type': 'application/json'}
        if headers:
            req_headers.update(headers)
        
        # Add session token if available
        if self.session_token and 'Authorization' not in req_headers:
            req_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=req_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=req_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=req_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:200]}")

            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}

            return success, response_data

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {"error": str(e)}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET", 
            "",
            200
        )
        
        if success and response.get("message") == "GuessIt API is running":
            print("   ✅ Correct message returned")
            return True
        else:
            print("   ❌ Incorrect response message")
            return False

    def test_user_registration(self):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": self.test_email,
                "password": self.test_password,
                "confirm_password": self.test_password
            }
        )
        
        if success and response.get("user"):
            self.user_id = response["user"]["user_id"]
            print(f"   ✅ User registered with ID: {self.user_id}")
            
            # Extract session token from cookies - check all cookies in session
            for cookie in self.session.cookies:
                if cookie.name == 'session_token':
                    self.session_token = cookie.value
                    print(f"   ✅ Session token captured: {self.session_token[:20]}...")
                    break
            
            if not self.session_token:
                print(f"   ⚠️ Session token not found in cookies")
                print(f"   Available cookies: {[c.name for c in self.session.cookies]}")
            
            return True
        else:
            print("   ❌ Registration failed")
            return False

    def test_set_nickname(self):
        """Test setting nickname after registration"""
        if not self.session_token:
            print("   ❌ No session token available")
            return False
            
        success, response = self.run_test(
            "Set Nickname",
            "POST",
            "auth/nickname",
            200,
            data={"nickname": self.test_nickname}
        )
        
        if success and response.get("user", {}).get("nickname") == self.test_nickname:
            self.nickname = self.test_nickname
            print(f"   ✅ Nickname set to: {self.nickname}")
            return True
        else:
            print("   ❌ Nickname setting failed")
            return False

    def test_auth_me(self):
        """Test auth/me endpoint"""
        if not self.session_token:
            print("   ❌ No session token available")
            return False
            
        success, response = self.run_test(
            "Auth Check (/me)",
            "GET",
            "auth/me",
            200
        )
        
        if success and response.get("user_id") == self.user_id:
            print(f"   ✅ Auth check successful for user: {self.user_id}")
            return True
        else:
            print("   ❌ Auth check failed")
            return False

    def test_football_matches(self):
        """Test football matches API"""
        success, response = self.run_test(
            "Football Matches",
            "GET",
            "football/matches",
            200
        )
        
        if success and "matches" in response:
            matches_count = len(response["matches"])
            print(f"   ✅ Retrieved {matches_count} matches")
            return True
        else:
            print("   ❌ Football matches retrieval failed")
            return False

    def test_football_competitions(self):
        """Test football competitions endpoint"""
        success, response = self.run_test(
            "Football Competitions",
            "GET",
            "football/competitions",
            200
        )
        
        if success and "competitions" in response:
            competitions_count = len(response["competitions"])
            print(f"   ✅ Retrieved {competitions_count} competitions")
            return True
        else:
            print("   ❌ Football competitions retrieval failed")
            return False

    def test_predictions_endpoints(self):
        """Test predictions endpoints"""
        if not self.session_token:
            print("   ❌ No session token available")
            return False
            
        # Test get predictions (should be empty initially)
        success, response = self.run_test(
            "Get My Predictions",
            "GET",
            "predictions/me",
            200
        )
        
        if success and "predictions" in response:
            print(f"   ✅ Retrieved predictions (count: {len(response['predictions'])})")
        
        # Test detailed predictions
        success, response = self.run_test(
            "Get My Predictions Detailed",
            "GET",
            "predictions/me/detailed",
            200
        )
        
        if success and "predictions" in response:
            print(f"   ✅ Retrieved detailed predictions")
            return True
        else:
            print("   ❌ Predictions retrieval failed")
            return False

    def test_favorites_clubs(self):
        """Test favorites clubs endpoint"""
        if not self.session_token:
            print("   ❌ No session token available")
            return False
            
        success, response = self.run_test(
            "Get Favorite Clubs",
            "GET",
            "favorites/clubs",
            200
        )
        
        if success and "favorites" in response:
            print(f"   ✅ Retrieved favorite clubs (count: {len(response['favorites'])})")
            return True
        else:
            print("   ❌ Favorites clubs retrieval failed")
            return False

    def test_friends_list(self):
        """Test friends list endpoint"""
        if not self.session_token:
            print("   ❌ No session token available")
            return False
            
        success, response = self.run_test(
            "Get Friends List",
            "GET",
            "friends/list",
            200
        )
        
        if success and "friends" in response:
            print(f"   ✅ Retrieved friends list (count: {len(response['friends'])})")
            return True
        else:
            print("   ❌ Friends list retrieval failed")
            return False

    def test_settings_profile(self):
        """Test settings profile endpoint"""
        if not self.session_token:
            print("   ❌ No session token available")
            return False
            
        success, response = self.run_test(
            "Get Settings Profile",
            "GET",
            "settings/profile",
            200
        )
        
        if success and response.get("data", {}).get("user_id") == self.user_id:
            print(f"   ✅ Retrieved settings profile for user: {self.user_id}")
            return True
        else:
            print("   ❌ Settings profile retrieval failed")
            return False

    def test_login(self):
        """Test login with created user"""
        # First logout to clear session
        self.session_token = None
        self.session.cookies.clear()
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": self.test_email,
                "password": self.test_password
            }
        )
        
        if success and response.get("user", {}).get("user_id") == self.user_id:
            print(f"   ✅ Login successful for user: {self.user_id}")
            
            # Extract session token from cookies
            for cookie in self.session.cookies:
                if cookie.name == 'session_token':
                    self.session_token = cookie.value
                    print(f"   ✅ Session token captured after login: {self.session_token[:20]}...")
                    break
            
            return True
        else:
            print("   ❌ Login failed")
            return False

    def run_comprehensive_test(self):
        """Run comprehensive test suite"""
        print("=" * 60)
        print("🚀 Starting GuessIt API Comprehensive Test Suite")
        print("=" * 60)
        
        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Critical: Root endpoint failed - stopping tests")
            return False
            
        # Test football API (no auth required)
        self.test_football_competitions()
        self.test_football_matches()
        
        # Test authentication flow
        if not self.test_user_registration():
            print("❌ Critical: Registration failed - stopping auth tests")
        else:
            self.test_set_nickname()
            self.test_auth_me()
            
            # Test authenticated endpoints
            self.test_predictions_endpoints()
            self.test_favorites_clubs() 
            self.test_friends_list()
            self.test_settings_profile()
            
            # Test login flow
            self.test_login()

        # Print results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("✅ Overall Status: GOOD")
            return True
        else:
            print("❌ Overall Status: NEEDS ATTENTION")
            return False

def main():
    """Main test execution"""
    # Get backend URL from environment
    backend_url = "https://guess-it-enhanced.preview.emergentagent.com"
    
    print(f"🎯 Testing GuessIt API at: {backend_url}")
    
    tester = GuessItAPITester(backend_url)
    
    try:
        success = tester.run_comprehensive_test()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ Critical error during testing: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())