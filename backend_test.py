#!/usr/bin/env python3
"""
Backend API Testing for Football-data.org API Integration
Tests the fixed football API functionality after URL normalization fix.
"""
import requests
import sys
import json
from datetime import datetime

class FootballAPITester:
    def __init__(self):
        self.base_url = "https://guess-it-fork.preview.emergentagent.com/api"
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Admin credentials from review request
        self.admin_email = "farhad.isgandar@gmail.com"
        self.admin_password = "Salam123?"
        
        # Football API key from review request  
        self.football_api_key = "8767f2a0d2ca4adabdfb9e93d1361de6"

    def run_test(self, name, test_func):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            success = test_func()
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - {name}")
            else:
                print(f"❌ Failed - {name}")
            return success
        except Exception as e:
            print(f"❌ Failed - {name}: {str(e)}")
            return False

    def login_admin(self):
        """Login as admin and get session token"""
        try:
            # Try different admin login endpoints
            endpoints_to_try = [
                f"{self.base_url}/auth/admin/login",
                f"{self.base_url}/admin/auth/login",
                f"{self.base_url}/auth/login"
            ]
            
            response = None
            for endpoint in endpoints_to_try:
                try:
                    response = requests.post(
                        endpoint,
                        json={
                            "email": self.admin_email,
                            "password": self.admin_password
                        },
                        timeout=10
                    )
                    if response.status_code == 200:
                        print(f"Admin login successful via {endpoint}")
                        break
                    else:
                        print(f"Tried {endpoint}: {response.status_code}")
                except Exception as e:
                    print(f"Tried {endpoint}: {str(e)}")
                    
            if not response or response.status_code != 200:
                print(f"All admin login endpoints failed")
                return False
            
            # Extract session token from set-cookie header
            cookies = response.headers.get('set-cookie', '')
            print(f"Response cookies: {cookies}")
            
            if 'session_token=' in cookies:
                # Parse session token from cookie
                start = cookies.find('session_token=') + len('session_token=')
                end = cookies.find(';', start)
                if end == -1:
                    end = len(cookies)
                self.session_token = cookies[start:end]
                print(f"Admin login successful, session token obtained: {self.session_token[:20]}...")
                return True
            else:
                # Also check response.cookies
                if 'session_token' in response.cookies:
                    self.session_token = response.cookies['session_token']
                    print(f"Admin login successful, session token from response.cookies")
                    return True
                else:
                    print(f"No session token in response cookies. Available cookies: {list(response.cookies.keys())}")
                    return False
                
        except Exception as e:
            print(f"Admin login error: {str(e)}")
            return False

    def test_admin_dashboard_total_matches(self):
        """Test admin dashboard shows Total Matches > 0"""
        if not self.session_token:
            print("No session token available")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/admin/dashboard",
                cookies={'session_token': self.session_token},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                total_matches = data.get('total_matches', 0)
                print(f"Dashboard shows {total_matches} total matches")
                return total_matches > 0
            else:
                print(f"Dashboard request failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"Dashboard test error: {str(e)}")
            return False

    def test_system_apis_list(self):
        """Test listing system APIs in admin panel"""
        if not self.session_token:
            print("No session token available")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/admin/system/apis",
                cookies={'session_token': self.session_token},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                apis = data.get('apis', [])
                print(f"Found {len(apis)} API configurations")
                
                # Check if football-data.org API is present and active
                football_api_found = False
                for api in apis:
                    print(f"API: {api.get('name')} - {api.get('base_url')} - Active: {api.get('is_active')}")
                    if 'football-data.org' in str(api.get('base_url', '')).lower():
                        football_api_found = True
                        is_active = api.get('is_active', False)
                        print(f"Football-data.org API found - Active: {is_active}")
                        return is_active
                
                if not football_api_found:
                    print("No football-data.org API configuration found")
                    
                return len(apis) > 0
            else:
                print(f"System APIs request failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"System APIs test error: {str(e)}")
            return False

    def test_add_football_api_with_normalization(self):
        """Test adding football API with base_url normalization"""
        if not self.session_token:
            print("No session token available")
            return False
            
        try:
            # Test adding API with just 'football-data.org' (should normalize to https://api.football-data.org/v4)
            response = requests.post(
                f"{self.base_url}/admin/system/apis",
                json={
                    "name": "Football-data.org Test",
                    "base_url": "football-data.org",  # Test normalization
                    "api_key": self.football_api_key
                },
                cookies={'session_token': self.session_token},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                api = data.get('api', {})
                base_url = api.get('base_url', '')
                print(f"API added with normalized base_url: {base_url}")
                
                # Check if URL was normalized correctly
                expected_url = "https://api.football-data.org/v4"
                return base_url == expected_url
            else:
                print(f"Add API request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"Add API test error: {str(e)}")
            return False

    def test_api_validation(self):
        """Test API validation endpoint"""
        if not self.session_token:
            print("No session token available")
            return False
            
        try:
            response = requests.post(
                f"{self.base_url}/admin/system/apis/validate",
                json={
                    "api_key": self.football_api_key,
                    "base_url": "football-data.org"  # Should be normalized internally
                },
                cookies={'session_token': self.session_token},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                is_valid = data.get('valid', False)
                provider = data.get('provider', '')
                print(f"API validation result: {is_valid}, provider: {provider}")
                return is_valid and provider == 'football-data.org'
            else:
                print(f"API validation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"API validation error: {str(e)}")
            return False

    def test_football_matches_api(self):
        """Test football matches API returns matches (not empty)"""
        try:
            response = requests.get(
                f"{self.base_url}/football/matches",
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                matches = data.get('matches', [])
                print(f"Football matches API returned {len(matches)} matches")
                return len(matches) > 0
            else:
                print(f"Football matches API failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"Football matches API error: {str(e)}")
            return False

    def test_friends_invite_match_endpoint(self):
        """Test friends invite match endpoint accepts match_card field"""
        if not self.session_token:
            print("No session token available")
            return False
            
        try:
            # Test the endpoint with match_card field
            test_payload = {
                "friend_user_id": "test_friend_123",
                "match_id": 12345,
                "home_team": "Manchester United",
                "away_team": "Liverpool",
                "match_date": "2024-01-15T15:00:00Z",
                "match_card": {
                    "match_id": 12345,
                    "homeTeam": {
                        "name": "Manchester United",
                        "crest": "https://example.com/crest1.png"
                    },
                    "awayTeam": {
                        "name": "Liverpool", 
                        "crest": "https://example.com/crest2.png"
                    },
                    "competition": "Premier League",
                    "dateTime": "2024-01-15T15:00:00Z",
                    "status": "NOT_STARTED",
                    "score": {}
                }
            }
            
            response = requests.post(
                f"{self.base_url}/friends/invite/match",
                json=test_payload,
                cookies={'session_token': self.session_token},
                timeout=10
            )
            
            # We expect this to fail with 403 (not friends) or 404 (friend not found)
            # but not with 422 (validation error), which would indicate the match_card field is rejected
            if response.status_code in [403, 404]:
                print(f"Endpoint accepts match_card field - got expected {response.status_code}")
                return True
            elif response.status_code == 422:
                error_text = response.text
                if "match_card" in error_text.lower():
                    print(f"Endpoint rejects match_card field: {error_text}")
                    return False
                else:
                    print(f"Endpoint validation error (not related to match_card): {error_text}")
                    return True
            else:
                print(f"Unexpected response: {response.status_code} - {response.text}")
                return response.status_code == 200
                
        except Exception as e:
            print(f"Friends invite match endpoint error: {str(e)}")
            return False

    def test_basic_endpoints(self):
        """Test basic API endpoints are working"""
        try:
            # Test API root
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code != 200:
                print(f"API root failed: {response.status_code}")
                return False
            
            # Test health endpoint
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code != 200:
                print(f"Health endpoint failed: {response.status_code}")
                return False
                
            print("Basic endpoints are working")
            return True
            
        except Exception as e:
            print(f"Basic endpoints error: {str(e)}")
            return False

def main():
    print("🚀 Starting Football API Backend Testing...")
    tester = FootballAPITester()
    
    # Run tests in sequence
    tests = [
        ("Basic API Endpoints", tester.test_basic_endpoints),
        ("Admin Login", tester.login_admin),
        ("Admin Dashboard Total Matches", tester.test_admin_dashboard_total_matches),
        ("System APIs List", tester.test_system_apis_list),
        ("Football API Validation", tester.test_api_validation),
        ("Add API with URL Normalization", tester.test_add_football_api_with_normalization),
        ("Football Matches API", tester.test_football_matches_api),
        ("Friends Invite Match Endpoint", tester.test_friends_invite_match_endpoint),
    ]
    
    for test_name, test_func in tests:
        tester.run_test(test_name, test_func)
    
    # Print results
    print(f"\n📊 Tests completed: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 70 else 1

if __name__ == "__main__":
    sys.exit(main())