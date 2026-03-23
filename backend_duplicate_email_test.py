#!/usr/bin/env python3
"""
Backend API Test Suite for Duplicate Email Error Handling
Tests the specific fix for duplicate email registration
"""

import requests
import sys
import json
from datetime import datetime

class DuplicateEmailTester:
    def __init__(self, base_url="https://guess-it-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 10
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
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

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"    ✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"    📄 Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, response.text
            else:
                print(f"    ❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"    📄 Error: {json.dumps(error_data, indent=2)}")
                    return False, error_data
                except:
                    print(f"    📄 Error: {response.text}")
                    return False, {}

        except Exception as e:
            print(f"    ❌ Failed - Error: {str(e)}")
            return False, {}

    def test_new_email_registration(self):
        """Test registration with new email returns 200"""
        print("\n" + "="*50)
        print("✅ TESTING NEW EMAIL REGISTRATION")
        print("="*50)
        
        # Generate unique email
        unique_email = f"newuser_{datetime.now().strftime('%H%M%S%f')[:-3]}@test.com"
        test_password = "TestPass123!"
        
        success, data = self.run_test(
            "Register with New Email",
            "POST",
            "auth/register",
            200,
            data={
                "email": unique_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        if success:
            # Verify response structure
            if isinstance(data, dict):
                if 'user' not in data:
                    print("    ⚠️  Warning: Registration response missing user data")
                    return False
                if 'message' not in data:
                    print("    ⚠️  Warning: Registration response missing message")
                    return False
                print("    ✅ New email registration successful with proper response structure")
            return True
        else:
            print("    ❌ New email registration failed")
            return False

    def test_duplicate_email_registration(self):
        """Test registration with duplicate email returns 409"""
        print("\n" + "="*50)
        print("🚫 TESTING DUPLICATE EMAIL REGISTRATION")
        print("="*50)
        
        # Use the existing test user
        duplicate_email = "testdupe@test.com"
        test_password = "TestPass123"
        
        success, data = self.run_test(
            "Register with Duplicate Email",
            "POST",
            "auth/register",
            409,  # Expecting 409 Conflict
            data={
                "email": duplicate_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        if success:
            # Verify error message
            if isinstance(data, dict):
                detail = data.get('detail', '')
                expected_message = "This email is already registered. Please log in instead."
                if detail == expected_message:
                    print("    ✅ Duplicate email returns correct 409 status and message")
                    return True
                else:
                    print(f"    ❌ Wrong error message. Expected: '{expected_message}', Got: '{detail}'")
                    return False
            else:
                print("    ❌ Response is not JSON format")
                return False
        else:
            print("    ❌ Duplicate email test failed - wrong status code")
            return False

    def test_login_with_existing_user(self):
        """Test login still works with existing user"""
        print("\n" + "="*50)
        print("🔐 TESTING LOGIN WITH EXISTING USER")
        print("="*50)
        
        # Use the existing test user
        email = "testdupe@test.com"
        password = "TestPass123"
        
        success, data = self.run_test(
            "Login with Existing User",
            "POST",
            "auth/login",
            200,
            data={
                "email": email,
                "password": password
            }
        )
        
        if success:
            # Verify login response structure
            if isinstance(data, dict):
                if 'user' not in data:
                    print("    ⚠️  Warning: Login response missing user data")
                    return False
                if 'message' not in data:
                    print("    ⚠️  Warning: Login response missing message")
                    return False
                print("    ✅ Login with existing user successful")
            return True
        else:
            print("    ❌ Login with existing user failed")
            return False

    def run_duplicate_email_tests(self):
        """Run all duplicate email related tests"""
        print("🚀 Starting Duplicate Email Error Handling Tests")
        print(f"📡 Testing against: {self.base_url}")
        print("⏱️  Started at:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        
        # Run specific tests
        try:
            test_results = []
            
            # Test 1: New email registration should work
            result1 = self.test_new_email_registration()
            test_results.append(("New Email Registration", result1))
            
            # Test 2: Duplicate email should return 409
            result2 = self.test_duplicate_email_registration()
            test_results.append(("Duplicate Email Registration", result2))
            
            # Test 3: Login should still work
            result3 = self.test_login_with_existing_user()
            test_results.append(("Login with Existing User", result3))
            
        except Exception as e:
            print(f"❌ Test suite crashed: {e}")
            return False
            
        # Print final results
        print("\n" + "="*60)
        print("📊 DUPLICATE EMAIL TEST RESULTS")
        print("="*60)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status}: {test_name}")
        
        print(f"\n✅ Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All duplicate email tests passed!")
            return True
        else:
            print("❌ Some duplicate email tests failed")
            return False

def main():
    """Main test runner"""
    tester = DuplicateEmailTester()
    success = tester.run_duplicate_email_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())