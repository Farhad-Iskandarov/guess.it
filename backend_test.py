#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for GuessIt Error Handling
Tests all error scenarios to ensure clean, user-friendly error messages
"""

import requests
import sys
import json
from datetime import datetime

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "passed": passed,
            "details": details
        })

    def test_auth_register_duplicate_email(self):
        """Test duplicate email registration returns 409 with user-friendly message"""
        print("\n🔍 Testing duplicate email registration...")
        
        # First, register a test user
        test_email = "testdupe@test.com"
        test_password = "TestPass123"
        
        register_data = {
            "email": test_email,
            "password": test_password,
            "confirm_password": test_password
        }
        
        try:
            # Try to register (might already exist)
            response = self.session.post(
                f"{self.base_url}/api/auth/register",
                json=register_data,
                headers={'Content-Type': 'application/json'}
            )
            
            # Now try to register again with same email
            duplicate_response = self.session.post(
                f"{self.base_url}/api/auth/register",
                json=register_data,
                headers={'Content-Type': 'application/json'}
            )
            
            # Check status code
            if duplicate_response.status_code == 409:
                try:
                    error_data = duplicate_response.json()
                    detail = error_data.get('detail', '')
                    
                    # Check for user-friendly message
                    expected_message = "This email is already registered. Please log in instead."
                    if detail == expected_message:
                        self.log_test("Duplicate email returns 409 with correct message", True)
                    else:
                        self.log_test("Duplicate email returns 409 with correct message", False, 
                                    f"Expected: '{expected_message}', Got: '{detail}'")
                except json.JSONDecodeError:
                    self.log_test("Duplicate email returns 409 with correct message", False, 
                                "Response body is not valid JSON")
            else:
                self.log_test("Duplicate email returns 409 with correct message", False, 
                            f"Expected status 409, got {duplicate_response.status_code}")
                
        except Exception as e:
            self.log_test("Duplicate email returns 409 with correct message", False, str(e))

    def test_auth_login_wrong_credentials(self):
        """Test login with wrong credentials returns clean error"""
        print("\n🔍 Testing login with wrong credentials...")
        
        login_data = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json=login_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code in [400, 401]:
                try:
                    error_data = response.json()
                    detail = error_data.get('detail', '')
                    
                    # Check that error message is user-friendly (not technical)
                    technical_terms = ['traceback', 'internal server', 'typeerror', 'referenceerror', 
                                     'syntaxerror', 'module', 'import', 'undefined', 'null', 'nan', 
                                     'stack', 'mongodb', 'redis', 'pymongo', 'motor', 'asyncio']
                    
                    is_technical = any(term in detail.lower() for term in technical_terms)
                    
                    if not is_technical and len(detail) > 0:
                        self.log_test("Wrong login credentials returns clean error", True)
                    else:
                        self.log_test("Wrong login credentials returns clean error", False, 
                                    f"Error message appears technical: '{detail}'")
                except json.JSONDecodeError:
                    self.log_test("Wrong login credentials returns clean error", False, 
                                "Response body is not valid JSON")
            else:
                self.log_test("Wrong login credentials returns clean error", False, 
                            f"Expected status 400/401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Wrong login credentials returns clean error", False, str(e))

    def test_predictions_unauthenticated(self):
        """Test prediction save as unauthenticated user returns clean error"""
        print("\n🔍 Testing unauthenticated prediction save...")
        
        # Clear any existing session
        self.session.cookies.clear()
        
        prediction_data = {
            "match_id": "test_match_123",
            "prediction": "home"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/predictions",
                json=prediction_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 401:
                try:
                    error_data = response.json()
                    detail = error_data.get('detail', '')
                    
                    # Check that error message is user-friendly
                    technical_terms = ['traceback', 'internal server', 'typeerror', 'referenceerror']
                    is_technical = any(term in detail.lower() for term in technical_terms)
                    
                    if not is_technical:
                        self.log_test("Unauthenticated prediction returns clean 401", True)
                    else:
                        self.log_test("Unauthenticated prediction returns clean 401", False, 
                                    f"Error message appears technical: '{detail}'")
                except json.JSONDecodeError:
                    self.log_test("Unauthenticated prediction returns clean 401", False, 
                                "Response body is not valid JSON")
            else:
                self.log_test("Unauthenticated prediction returns clean 401", False, 
                            f"Expected status 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Unauthenticated prediction returns clean 401", False, str(e))

    def test_api_endpoints_basic(self):
        """Test basic API endpoints for clean error responses"""
        print("\n🔍 Testing basic API endpoints...")
        
        endpoints = [
            ("/api/auth/me", "GET"),
            ("/api/predictions/me", "GET"),
            ("/api/friends/list", "GET"),
            ("/api/favorites/clubs", "GET")
        ]
        
        for endpoint, method in endpoints:
            try:
                if method == "GET":
                    response = self.session.get(f"{self.base_url}{endpoint}")
                else:
                    response = self.session.post(f"{self.base_url}{endpoint}")
                
                # Check that response is valid JSON and doesn't contain technical errors
                try:
                    if response.headers.get('content-type', '').startswith('application/json'):
                        data = response.json()
                        
                        # Check for technical error messages in response
                        response_str = json.dumps(data).lower()
                        technical_terms = ['failed to execute json', 'body stream already read', 
                                         'traceback', 'internal server error', 'typeerror']
                        
                        has_technical_error = any(term in response_str for term in technical_terms)
                        
                        if not has_technical_error:
                            self.log_test(f"{endpoint} returns clean response", True)
                        else:
                            self.log_test(f"{endpoint} returns clean response", False, 
                                        "Response contains technical error messages")
                    else:
                        self.log_test(f"{endpoint} returns clean response", True, "Non-JSON response")
                        
                except json.JSONDecodeError:
                    self.log_test(f"{endpoint} returns clean response", False, 
                                "Response is not valid JSON")
                    
            except Exception as e:
                self.log_test(f"{endpoint} returns clean response", False, str(e))

    def test_settings_endpoints(self):
        """Test settings endpoints for clean error handling"""
        print("\n🔍 Testing settings endpoints...")
        
        # Test profile settings without auth
        try:
            response = self.session.get(f"{self.base_url}/api/settings/profile")
            
            if response.status_code == 401:
                try:
                    error_data = response.json()
                    detail = error_data.get('detail', '')
                    
                    # Check for clean error message
                    technical_terms = ['traceback', 'internal server', 'typeerror']
                    is_technical = any(term in detail.lower() for term in technical_terms)
                    
                    if not is_technical:
                        self.log_test("Settings profile endpoint returns clean 401", True)
                    else:
                        self.log_test("Settings profile endpoint returns clean 401", False, 
                                    f"Technical error: '{detail}'")
                except json.JSONDecodeError:
                    self.log_test("Settings profile endpoint returns clean 401", False, 
                                "Invalid JSON response")
            else:
                self.log_test("Settings profile endpoint returns clean 401", False, 
                            f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Settings profile endpoint returns clean 401", False, str(e))

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting GuessIt Backend Error Handling Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Run all test methods
        self.test_auth_register_duplicate_email()
        self.test_auth_login_wrong_credentials()
        self.test_predictions_unauthenticated()
        self.test_api_endpoints_basic()
        self.test_settings_endpoints()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Backend Tests Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend error handling tests passed!")
            return True
        else:
            print("⚠️  Some backend tests failed - check error handling implementation")
            return False

def main():
    tester = GuessItAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())