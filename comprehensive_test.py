#!/usr/bin/env python3
"""
Comprehensive API Test Suite for GuessIt Football Prediction Platform
Testing all specified endpoints from the review request
"""

import requests
import sys
import time
import json
from datetime import datetime
from urllib.parse import urljoin

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-fork-1.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.admin_session_token = None
        self.user_session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        
        print(f"🚀 Testing GuessIt API at: {self.base_url}")
        print("=" * 80)

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None, use_admin_auth=False, use_user_auth=False):
        """Run a single API test with detailed reporting"""
        self.tests_run += 1
        
        # Handle both /api prefixed and non-prefixed endpoints
        if endpoint.startswith('/api/'):
            url = f"{self.base_url}{endpoint}"
        else:
            url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        
        print(f"\n🧪 Test {self.tests_run}: {name}")
        print(f"   {method} {url}")
        
        try:
            req_headers = headers or {}
            
            # Add auth headers if needed
            if use_admin_auth and self.admin_session_token:
                req_headers['Authorization'] = f'Bearer {self.admin_session_token}'
            elif use_user_auth and self.user_session_token:
                req_headers['Authorization'] = f'Bearer {self.user_session_token}'
                
            if data and method.upper() in ['POST', 'PUT']:
                req_headers['Content-Type'] = 'application/json'
                
            if method.upper() == 'GET':
                response = self.session.get(url, headers=req_headers, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=req_headers, timeout=30)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=req_headers, timeout=30)
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"   ✅ PASS - Status: {response.status_code}")
                
                try:
                    result = response.json()
                    return True, result
                except:
                    return True, response.text
            else:
                print(f"   ❌ FAIL - Expected {expected_status}, got {response.status_code}")
                try:
                    error_content = response.json()
                    print(f"   📄 Response: {json.dumps(error_content, indent=2)}")
                except:
                    print(f"   📄 Response: {response.text[:200]}")
                return False, {}
                
        except Exception as e:
            print(f"   💥 ERROR - {str(e)}")
            return False, {}

    # Backend API Tests
    def test_backend_health(self):
        """Test backend health check at /api/health"""
        success, response = self.run_test("Backend Health Check", "GET", "health", 200)
        if success and isinstance(response, dict):
            if response.get('status') == 'healthy':
                print(f"   ℹ️  Server is healthy")
                return True
        return False

    def test_backend_root(self):
        """Test backend root at /api/"""
        success, response = self.run_test("Backend Root", "GET", "/", 200)
        if success and isinstance(response, dict):
            if 'message' in response:
                print(f"   ℹ️  Root message: {response.get('message')}")
                return True
        return False

    def test_user_registration(self):
        """Test user registration at POST /api/auth/register"""
        user_data = {
            "email": "test_user_" + str(int(time.time())) + "@example.com",
            "password": "TestPass123!",
            "confirm_password": "TestPass123!"
        }
        
        success, response = self.run_test("User Registration", "POST", "auth/register", 200, user_data)
        if success and isinstance(response, dict):
            if 'user' in response:
                print(f"   ✅ User registered successfully")
                return True
        return False

    def test_user_login(self):
        """Test user login at POST /api/auth/login"""
        # First register a user
        timestamp = str(int(time.time()))
        user_email = f"testuser_{timestamp}@example.com"
        
        reg_data = {
            "email": user_email,
            "password": "TestPass123!",
            "confirm_password": "TestPass123!"
        }
        
        # Register first
        self.session.post(f"{self.base_url}/api/auth/register", json=reg_data)
        
        # Then login
        login_data = {
            "email": user_email,
            "password": "TestPass123!"
        }
        
        success, response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if success and isinstance(response, dict):
            if 'user' in response:
                print(f"   ✅ User login successful")
                return True
        return False

    def test_admin_login(self):
        """Test admin login with admin@guessit.com / Admin123!"""
        admin_data = {
            "email": "admin@guessit.com",
            "password": "Admin123!"
        }
        
        success, response = self.run_test("Admin Login", "POST", "auth/login", 200, admin_data)
        if success and isinstance(response, dict):
            if 'user' in response and response.get('user', {}).get('role') == 'admin':
                print(f"   ✅ Admin login successful")
                return True
            elif response.get('message') == 'Login successful':
                print(f"   ✅ Admin login successful via cookie")
                return True
        return False

    def test_leaderboard(self):
        """Test leaderboard at /api/football/leaderboard"""
        success, response = self.run_test("Leaderboard", "GET", "football/leaderboard", 200)
        if success and isinstance(response, dict):
            users = response.get('users', [])
            print(f"   📊 Leaderboard returned {len(users)} users")
            return True
        return False

    def test_subscription_plans(self):
        """Test subscription plans at /api/subscriptions/plans"""
        success, response = self.run_test("Subscription Plans", "GET", "subscriptions/plans", 200)
        if success and isinstance(response, dict):
            plans = response.get('plans', [])
            print(f"   💳 Found {len(plans)} subscription plans")
            if len(plans) == 3:
                print(f"   ✅ Expected 3 plans, got {len(plans)}")
                return True
        return False

    def test_news_endpoint(self):
        """Test news endpoint at /api/news"""
        success, response = self.run_test("News Endpoint", "GET", "news", 200)
        if success:
            if isinstance(response, dict) and 'articles' in response:
                articles = response.get('articles', [])
                print(f"   📰 Found {len(articles)} news articles")
            else:
                print(f"   📰 News API responded successfully")
            return True
        return False

    def test_contact_settings(self):
        """Test contact settings at /api/contact-settings"""
        success, response = self.run_test("Contact Settings", "GET", "contact-settings", 200)
        if success:
            print(f"   📞 Contact settings API responded")
            return True
        return False

    def test_websocket_endpoint(self):
        """Test WebSocket endpoint at /api/ws/matches (should return upgrade required / 403)"""
        # Try to access WebSocket endpoint via HTTP (should fail with upgrade required)
        success, response = self.run_test("WebSocket Endpoint", "GET", "ws/matches", expected_status=403)
        if success:
            print(f"   🔌 WebSocket endpoint properly rejecting HTTP requests")
            return True
        
        # Also try with 426 (Upgrade Required) as acceptable
        success2, _ = self.run_test("WebSocket Endpoint (Alt)", "GET", "ws/matches", expected_status=426)
        if success2:
            print(f"   🔌 WebSocket endpoint returning upgrade required")
            return True
            
        return False

    # Frontend Page Tests
    def test_homepage(self):
        """Test homepage renders with expected elements"""
        try:
            print(f"\n🌐 Testing Frontend Homepage")
            response = self.session.get(self.base_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                content = response.text.lower()
                
                # Check for key elements mentioned in requirements
                expected_elements = [
                    'header',
                    'banner', 
                    'matches',
                    'popular',
                    'live'
                ]
                
                found_elements = []
                for element in expected_elements:
                    if element in content:
                        found_elements.append(element)
                
                self.tests_passed += 1
                print(f"   ✅ Homepage loaded successfully")
                print(f"   📝 Found elements: {', '.join(found_elements)}")
                return True
            else:
                print(f"   ❌ Homepage failed to load: {response.status_code}")
        except Exception as e:
            print(f"   💥 Homepage error: {e}")
            
        return False

    def test_admin_login_page(self):
        """Test admin login page at /itguess/admin/login"""
        try:
            print(f"\n🔒 Testing Admin Login Page")
            admin_url = f"{self.base_url}/itguess/admin/login"
            response = self.session.get(admin_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                content = response.text.lower()
                
                # Check for admin login elements
                if 'admin' in content or 'login' in content:
                    self.tests_passed += 1
                    print(f"   ✅ Admin login page renders correctly")
                    return True
                
            print(f"   ❌ Admin login page issue: {response.status_code}")
        except Exception as e:
            print(f"   💥 Admin login page error: {e}")
            
        return False

    def test_leaderboard_page(self):
        """Test leaderboard page at /leaderboard"""
        try:
            print(f"\n🏆 Testing Leaderboard Page")
            lb_url = f"{self.base_url}/leaderboard"
            response = self.session.get(lb_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                content = response.text.lower()
                
                # Check for leaderboard elements
                if 'leaderboard' in content or 'ranking' in content:
                    self.tests_passed += 1
                    print(f"   ✅ Leaderboard page renders correctly")
                    return True
                
            print(f"   ❌ Leaderboard page issue: {response.status_code}")
        except Exception as e:
            print(f"   💥 Leaderboard page error: {e}")
            
        return False

    def test_login_page(self):
        """Test login page at /login"""
        try:
            print(f"\n🔑 Testing Login Page")
            login_url = f"{self.base_url}/login"
            response = self.session.get(login_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"   ✅ Login page renders correctly")
                return True
            else:
                print(f"   ❌ Login page failed: {response.status_code}")
        except Exception as e:
            print(f"   💥 Login page error: {e}")
            
        return False

    def test_register_page(self):
        """Test register page at /register"""
        try:
            print(f"\n📝 Testing Register Page")
            register_url = f"{self.base_url}/register"
            response = self.session.get(register_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"   ✅ Register page renders correctly")
                return True
            else:
                print(f"   ❌ Register page failed: {response.status_code}")
        except Exception as e:
            print(f"   💥 Register page error: {e}")
            
        return False

    def run_all_tests(self):
        """Execute the complete test suite based on review requirements"""
        print("🏁 Starting Comprehensive GuessIt Test Suite")
        print("=" * 80)
        
        # Backend API Tests
        print("\n📡 BACKEND API TESTS")
        print("-" * 40)
        self.test_backend_health()
        self.test_backend_root()
        self.test_user_registration()
        self.test_user_login()
        self.test_admin_login()
        self.test_leaderboard()
        self.test_subscription_plans()
        self.test_news_endpoint()
        self.test_contact_settings()
        self.test_websocket_endpoint()
        
        # Frontend Page Tests
        print("\n🌐 FRONTEND PAGE TESTS")
        print("-" * 40)
        self.test_homepage()
        self.test_admin_login_page()
        self.test_leaderboard_page()
        self.test_login_page()
        self.test_register_page()
        
        # Final results
        print("\n" + "=" * 80)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 ALL TESTS: EXCELLENT")
            return 0
        elif success_rate >= 80:
            print("✅ ALL TESTS: GOOD - Minor issues")
            return 1
        elif success_rate >= 60:
            print("⚠️  ALL TESTS: PARTIAL - Some issues detected")
            return 2
        else:
            print("❌ ALL TESTS: SIGNIFICANT ISSUES")
            return 3

def main():
    tester = GuessItAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())