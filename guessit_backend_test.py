#!/usr/bin/env python3
"""
GuessIt Backend API Testing - Focus on specific requirements
"""
import requests
import sys
from datetime import datetime

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-fork.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session_cookies = None

    def log_test(self, name, success, message=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {message}")
        else:
            self.failed_tests.append(name)
            print(f"❌ {name}: FAILED {message}")

    def test_basic_api(self):
        """Test basic API endpoint - should return 'GuessIt API is running' message"""
        print("\n🔍 Testing Basic API Response...")
        try:
            response = self.session.get(f"{self.base_url}/api/", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "GuessIt API is running":
                    self.log_test("Backend API Basic Response", True, "- Message correct")
                    return True
                else:
                    self.log_test("Backend API Basic Response", False, f"- Expected 'GuessIt API is running', got: {data}")
                    return False
            else:
                self.log_test("Backend API Basic Response", False, f"- Status {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Backend API Basic Response", False, f"- Error: {str(e)}")
            return False

    def test_health_endpoint(self):
        """Test health check endpoint"""
        print("\n🔍 Testing Health Endpoint...")
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health Endpoint", True, "- Status is healthy")
                    return True
                else:
                    self.log_test("Health Endpoint", False, f"- Invalid health response: {data}")
                    return False
            else:
                self.log_test("Health Endpoint", False, f"- Status {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Endpoint", False, f"- Error: {str(e)}")
            return False

    def test_football_matches_api(self):
        """Test football matches API endpoint"""
        print("\n🔍 Testing Football Matches API...")
        try:
            response = self.session.get(f"{self.base_url}/api/football/matches", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if "matches" in data and "total" in data:
                    self.log_test("Football Matches API", True, f"- Found {data.get('total', 0)} matches")
                    return True
                else:
                    self.log_test("Football Matches API", False, f"- Invalid response structure: {list(data.keys()) if data else 'No data'}")
                    return False
            else:
                self.log_test("Football Matches API", False, f"- Status {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Football Matches API", False, f"- Error: {str(e)}")
            return False

    def test_subscriptions_api(self):
        """Test subscription plans API endpoint"""
        print("\n🔍 Testing Subscription Plans API...")
        try:
            response = self.session.get(f"{self.base_url}/api/subscriptions/plans", timeout=15)
            if response.status_code == 200:
                data = response.json()
                if "plans" in data:
                    plans_count = len(data.get("plans", []))
                    self.log_test("Subscription Plans API", True, f"- Found {plans_count} plans")
                    return True
                else:
                    self.log_test("Subscription Plans API", False, f"- Invalid response: {data}")
                    return False
            else:
                self.log_test("Subscription Plans API", False, f"- Status {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Subscription Plans API", False, f"- Error: {str(e)}")
            return False

    def test_admin_login(self):
        """Test admin login functionality"""
        print("\n🔍 Testing Admin Login...")
        try:
            admin_data = {
                "email": "farhad.isgandar@gmail.com",
                "password": "Salam123?"
            }
            response = self.session.post(f"{self.base_url}/api/auth/login", json=admin_data, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data and data["user"].get("role") == "admin":
                    self.session_cookies = response.cookies
                    self.log_test("Admin Login", True, f"- Logged in as {data['user'].get('email')}")
                    return True
                else:
                    self.log_test("Admin Login", False, f"- User role issue: {data.get('user', {}).get('role', 'unknown')}")
                    return False
            else:
                self.log_test("Admin Login", False, f"- Status {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Login", False, f"- Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting GuessIt Backend API Tests")
        print(f"🔗 Testing against: {self.base_url}")
        print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)

        # Run tests in order
        self.test_basic_api()
        self.test_health_endpoint()
        self.test_football_matches_api()
        self.test_subscriptions_api()
        self.test_admin_login()

        # Summary
        print("\n" + "=" * 60)
        print("📊 BACKEND TEST RESULTS")
        print("=" * 60)
        print(f"✅ Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests failed: {len(self.failed_tests)}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")

        if self.failed_tests:
            print(f"\n❌ Failed tests:")
            for test in self.failed_tests:
                print(f"   • {test}")

        print(f"\n🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = GuessItAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)