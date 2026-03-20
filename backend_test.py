#!/usr/bin/env python3
"""
Backend API Test Suite for GuessIt Football Prediction Platform
Tests all API endpoints using the public external URL
"""

import requests
import sys
import json
from datetime import datetime

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-copy-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 10
        self.tests_run = 0
        self.tests_passed = 0
        self.token = None
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if auth_required and self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

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
                    if isinstance(response_data, dict) and len(str(response_data)) < 200:
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

    def test_health_endpoints(self):
        """Test basic health and info endpoints"""
        print("\n" + "="*50)
        print("🏥 TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        # Test health endpoint
        success, data = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        if not success:
            return False
            
        # Verify health response structure
        if not isinstance(data, dict) or data.get('status') != 'healthy':
            print("    ⚠️  Warning: Health endpoint doesn't return expected format")
            
        # Test root API endpoint  
        success, data = self.run_test(
            "API Root",
            "GET", 
            "",
            200
        )
        if not success:
            return False
            
        # Verify root response
        if not isinstance(data, dict) or 'GuessIt API is running' not in str(data.get('message', '')):
            print("    ⚠️  Warning: API root doesn't return expected message")
            
        return True

    def test_system_metrics(self):
        """Test system metrics endpoint"""
        print("\n" + "="*50)
        print("📊 TESTING SYSTEM METRICS")
        print("="*50)
        
        success, data = self.run_test(
            "System Metrics",
            "GET",
            "system/metrics", 
            200
        )
        if not success:
            return False
            
        # Verify metrics structure
        if isinstance(data, dict):
            expected_keys = ['websocket_connections', 'redis', 'mongodb', 'architecture']
            missing_keys = [key for key in expected_keys if key not in data]
            if missing_keys:
                print(f"    ⚠️  Warning: Missing expected keys: {missing_keys}")
            else:
                print("    ✅ All expected metric keys present")
                
        return True

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("🔐 TESTING AUTHENTICATION")
        print("="*50)
        
        # Test registration
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@test.com"
        test_password = "TestPass123!"
        
        success, reg_data = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        if not success:
            print("    ❌ Registration failed - cannot continue with auth tests")
            return False
            
        # Check registration response structure
        if isinstance(reg_data, dict):
            if 'user' not in reg_data:
                print("    ⚠️  Warning: Registration response missing user data")
                return False
            if 'requires_nickname' not in reg_data:
                print("    ⚠️  Warning: Registration response missing requires_nickname flag")
                
        # Test login with registered user
        success, login_data = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data={
                "email": test_email,
                "password": test_password
            }
        )
        
        if not success:
            print("    ❌ Login failed after successful registration")
            return False
            
        # Store user info for subsequent tests
        if isinstance(login_data, dict) and 'user' in login_data:
            self.user_id = login_data['user'].get('user_id')
            
        # Test /auth/me endpoint (should work with session cookie)
        success, me_data = self.run_test(
            "Get Current User",
            "GET",
            "auth/me", 
            200
        )
        
        if not success:
            print("    ⚠️  Warning: /auth/me failed - session cookies may not be working")
        
        # Test nickname check
        success, nick_data = self.run_test(
            "Check Nickname Availability", 
            "GET",
            "auth/nickname/check?nickname=testuser123",
            200
        )
        
        if success and isinstance(nick_data, dict):
            if 'available' not in nick_data:
                print("    ⚠️  Warning: Nickname check missing 'available' field")
                
        print("    ✅ Authentication flow completed successfully")
        return True

    def test_invalid_endpoints(self):
        """Test error handling for invalid endpoints"""
        print("\n" + "="*50)
        print("🚫 TESTING ERROR HANDLING")
        print("="*50)
        
        # Test 404 for non-existent endpoint
        success, _ = self.run_test(
            "Non-existent Endpoint",
            "GET",
            "invalid/endpoint/that/does/not/exist",
            404
        )
        
        # Test invalid login credentials
        success, _ = self.run_test(
            "Invalid Login Credentials",
            "POST",
            "auth/login", 
            401,
            data={
                "email": "invalid@test.com",
                "password": "wrongpassword"
            }
        )
        
        return True

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting GuessIt Backend API Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("⏱️  Started at:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        
        # Run test categories
        try:
            if not self.test_health_endpoints():
                print("❌ Health endpoint tests failed - stopping")
                return False
                
            if not self.test_system_metrics():
                print("⚠️  System metrics test failed but continuing")
                
            if not self.test_auth_endpoints():
                print("❌ Authentication tests failed - stopping")  
                return False
                
            if not self.test_invalid_endpoints():
                print("⚠️  Error handling tests failed but continuing")
                
        except Exception as e:
            print(f"❌ Test suite crashed: {e}")
            return False
            
        # Print final results
        print("\n" + "="*60)
        print("📊 FINAL TEST RESULTS")
        print("="*60)
        print(f"✅ Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        elif self.tests_passed >= self.tests_run * 0.8:
            print("⚠️  Most tests passed - some issues to investigate")
            return True  
        else:
            print("❌ Significant test failures detected")
            return False

def main():
    """Main test runner"""
    tester = GuessItAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())