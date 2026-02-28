#!/usr/bin/env python3
"""
Complete Backend API Testing for GuessIt Football Prediction Platform
Tests all API endpoints specified in the testing requirements
"""

import requests
import json
from datetime import datetime
from typing import Dict, Any, Optional
import sys

class GuessItAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_result(self, test_name: str, success: bool, message: str = "", details: Dict = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {test_name}")
        if message:
            print(f"   {message}")

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log_result("Health Check", True, f"Status: {data.get('status')}")
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected status: {data.get('status')}")
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
        return False

    def test_root_api_endpoint(self):
        """Test /api/ root endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('message') == 'GuessIt API is running':
                    self.log_result("Root API Endpoint", True, f"Message: {data.get('message')}")
                    return True
                else:
                    self.log_result("Root API Endpoint", False, f"Unexpected message: {data.get('message')}")
            else:
                self.log_result("Root API Endpoint", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Root API Endpoint", False, f"Exception: {str(e)}")
        return False

    def test_user_registration(self):
        """Test /api/auth/register endpoint"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@test.com"
        test_password = "TestPass123!"
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/register",
                json={
                    "email": test_email,
                    "password": test_password
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('user') and data.get('requires_nickname'):
                    self.log_result("User Registration", True, f"User created with ID: {data.get('user', {}).get('user_id')}")
                    return True, data
                else:
                    self.log_result("User Registration", False, f"Unexpected response structure")
            else:
                self.log_result("User Registration", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("User Registration", False, f"Exception: {str(e)}")
        return False, None

    def test_user_login(self):
        """Test /api/auth/login endpoint"""
        # First register a user
        test_email = f"logintest_{datetime.now().strftime('%H%M%S')}@test.com"
        test_password = "TestPass123!"
        
        try:
            # Register user
            reg_response = self.session.post(
                f"{self.base_url}/api/auth/register",
                json={
                    "email": test_email,
                    "password": test_password
                },
                timeout=10
            )
            
            if reg_response.status_code != 200:
                self.log_result("User Login (Setup)", False, "Failed to create test user for login")
                return False
            
            # Now try to login
            login_response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": test_email,
                    "password": test_password
                },
                timeout=10
            )
            
            if login_response.status_code == 200:
                data = login_response.json()
                if data.get('user') and data.get('message'):
                    self.log_result("User Login", True, f"Login successful: {data.get('message')}")
                    return True
                else:
                    self.log_result("User Login", False, f"Unexpected login response")
            else:
                self.log_result("User Login", False, f"HTTP {login_response.status_code}")
        except Exception as e:
            self.log_result("User Login", False, f"Exception: {str(e)}")
        return False

    def test_get_current_user_unauthorized(self):
        """Test /api/auth/me returns 401 when not authenticated"""
        try:
            # Create a new session without authentication
            temp_session = requests.Session()
            response = temp_session.get(f"{self.base_url}/api/auth/me", timeout=10)
            
            if response.status_code == 401:
                self.log_result("Get Current User (Unauthorized)", True, "Correctly returned 401 for unauthenticated request")
                return True
            else:
                self.log_result("Get Current User (Unauthorized)", False, f"Expected 401, got HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Get Current User (Unauthorized)", False, f"Exception: {str(e)}")
        return False

    def test_news_endpoint(self):
        """Test /api/news endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/news", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'articles' in data and 'total' in data:
                    self.log_result("News Endpoint", True, f"Found {data.get('total', 0)} articles")
                    return True
                else:
                    self.log_result("News Endpoint", False, f"Unexpected response structure")
            else:
                self.log_result("News Endpoint", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("News Endpoint", False, f"Exception: {str(e)}")
        return False

    def test_subscription_plans(self):
        """Test /api/subscriptions/plans endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/subscriptions/plans", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                plans = data.get('plans', [])
                if len(plans) == 3:
                    plan_names = [p.get('name') for p in plans]
                    expected_names = ['Standard', 'Champion', 'Elite']
                    if all(name in plan_names for name in expected_names):
                        self.log_result("Subscription Plans", True, f"Found all 3 plans: {plan_names}")
                        return True
                    else:
                        self.log_result("Subscription Plans", False, f"Plan names don't match expected")
                else:
                    self.log_result("Subscription Plans", False, f"Expected 3 plans, found {len(plans)}")
            else:
                self.log_result("Subscription Plans", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Subscription Plans", False, f"Exception: {str(e)}")
        return False

    def test_football_matches(self):
        """Test /api/football/matches endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/football/matches", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'matches' in data and 'total' in data:
                    self.log_result("Football Matches", True, f"Found {data.get('total', 0)} matches")
                    return True
                else:
                    self.log_result("Football Matches", False, f"Unexpected response structure")
            else:
                self.log_result("Football Matches", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Football Matches", False, f"Exception: {str(e)}")
        return False

    def test_contact_settings(self):
        """Test /api/contact-settings endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/contact-settings", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['email_title', 'email_address', 'location_title', 'location_address']
                if all(field in data for field in required_fields):
                    self.log_result("Contact Settings", True, f"All required fields present")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_result("Contact Settings", False, f"Missing fields: {missing}")
            else:
                self.log_result("Contact Settings", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Contact Settings", False, f"Exception: {str(e)}")
        return False

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        admin_email = "admin@guessit.com"
        admin_password = "Admin123!"
        
        try:
            # Try regular login first
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={
                    "email": admin_email,
                    "password": admin_password
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                user = data.get('user', {})
                if user.get('role') == 'admin':
                    self.log_result("Admin Login", True, f"Admin login successful, role: {user.get('role')}")
                    return True
                else:
                    self.log_result("Admin Login", False, f"Login successful but role is not admin: {user.get('role')}")
            else:
                # Try admin-specific endpoint if it exists
                admin_response = self.session.post(
                    f"{self.base_url}/api/admin/login",
                    json={
                        "email": admin_email,
                        "password": admin_password
                    },
                    timeout=10
                )
                
                if admin_response.status_code == 200:
                    data = admin_response.json()
                    self.log_result("Admin Login", True, f"Admin login via /api/admin/login successful")
                    return True
                else:
                    self.log_result("Admin Login", False, f"Regular login: HTTP {response.status_code}, Admin login: HTTP {admin_response.status_code}")
        except Exception as e:
            self.log_result("Admin Login", False, f"Exception: {str(e)}")
        return False

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting GuessIt Backend API Tests")
        print(f"📍 Backend URL: {self.base_url}")
        print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        # Test each endpoint
        self.test_health_endpoint()
        self.test_root_api_endpoint()
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user_unauthorized()
        self.test_news_endpoint()
        self.test_subscription_plans()
        self.test_football_matches()
        self.test_contact_settings()
        self.test_admin_login()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results Summary:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    backend_url = "https://guessit-fork.preview.emergentagent.com"
    
    tester = GuessItAPITester(backend_url)
    success = tester.run_all_tests()
    
    # Save results to file for analysis
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': tester.tests_passed/tester.tests_run if tester.tests_run > 0 else 0,
            'results': tester.results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())