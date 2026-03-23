#!/usr/bin/env python3
"""
Comprehensive Error Reporting System Testing for GuessIt
Tests the automatic error reporting from frontend error boundaries
"""

import requests
import sys
import json
import time
from datetime import datetime

class ErrorReportingTester:
    def __init__(self, base_url="https://guess-it-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.admin_token = None
        self.test_error_ids = []

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

    def login_admin(self):
        """Login as admin to test admin-only endpoints"""
        print("\n🔐 Logging in as admin...")
        
        login_data = {
            "email": "admin@guessit.com",
            "password": "Admin123!"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json=login_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get('token')
                print("✅ Admin login successful")
                return True
            else:
                print(f"❌ Admin login failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Admin login error: {str(e)}")
            return False

    def test_error_report_endpoint(self):
        """Test POST /api/error-logs/report accepts error report and returns {status: ok}"""
        print("\n🔍 Testing error report endpoint...")
        
        error_data = {
            "message": "Test error from automated testing",
            "stack": "Error: Test error\n    at TestComponent.render (TestComponent.js:10:15)",
            "componentStack": "    in TestComponent (at App.js:20:5)\n    in App (at index.js:7:3)",
            "route": "/test-page",
            "boundaryLabel": "TestBoundary",
            "userAgent": "Mozilla/5.0 (Test) AppleWebKit/537.36",
            "screen": "1920x1080",
            "language": "en-US"
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/error-logs/report",
                json=error_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get('status') == 'ok':
                        self.log_test("Error report endpoint accepts report and returns {status: ok}", True)
                    else:
                        self.log_test("Error report endpoint accepts report and returns {status: ok}", False, 
                                    f"Expected {{status: ok}}, got {data}")
                except json.JSONDecodeError:
                    self.log_test("Error report endpoint accepts report and returns {status: ok}", False, 
                                "Response is not valid JSON")
            else:
                self.log_test("Error report endpoint accepts report and returns {status: ok}", False, 
                            f"Expected status 200, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Error report endpoint accepts report and returns {status: ok}", False, str(e))

    def test_error_report_rate_limiting(self):
        """Test rate limiting: max 5 per minute per IP, 6th request returns 429"""
        print("\n🔍 Testing error report rate limiting...")
        
        error_data = {
            "message": "Rate limit test error",
            "stack": "Error: Rate limit test",
            "route": "/rate-limit-test",
            "boundaryLabel": "RateLimitBoundary"
        }
        
        try:
            # Send 5 requests (should all succeed)
            success_count = 0
            for i in range(5):
                response = self.session.post(
                    f"{self.base_url}/api/error-logs/report",
                    json={**error_data, "message": f"Rate limit test error {i+1}"},
                    headers={'Content-Type': 'application/json'}
                )
                if response.status_code == 200:
                    success_count += 1
                time.sleep(0.1)  # Small delay between requests
            
            # 6th request should be rate limited
            response = self.session.post(
                f"{self.base_url}/api/error-logs/report",
                json={**error_data, "message": "Rate limit test error 6 (should fail)"},
                headers={'Content-Type': 'application/json'}
            )
            
            if success_count == 5 and response.status_code == 429:
                self.log_test("Rate limiting works (5 allowed, 6th returns 429)", True)
            else:
                self.log_test("Rate limiting works (5 allowed, 6th returns 429)", False, 
                            f"Success count: {success_count}/5, 6th request status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Rate limiting works (5 allowed, 6th returns 429)", False, str(e))

    def test_error_logs_list_admin_only(self):
        """Test GET /api/error-logs returns paginated list (admin-only, 401 for unauthenticated)"""
        print("\n🔍 Testing error logs list endpoint...")
        
        # Test without authentication first
        try:
            # Clear session cookies
            temp_session = requests.Session()
            response = temp_session.get(f"{self.base_url}/api/error-logs")
            
            if response.status_code == 401:
                self.log_test("Error logs list returns 401 for unauthenticated", True)
            else:
                self.log_test("Error logs list returns 401 for unauthenticated", False, 
                            f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Error logs list returns 401 for unauthenticated", False, str(e))
        
        # Test with admin authentication
        if self.admin_token:
            try:
                headers = {'Authorization': f'Bearer {self.admin_token}'}
                response = self.session.get(f"{self.base_url}/api/error-logs", headers=headers)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if 'logs' in data and 'total' in data and 'page' in data:
                            self.log_test("Error logs list returns paginated data for admin", True)
                            # Store some error IDs for later tests
                            if data['logs']:
                                self.test_error_ids = [log.get('error_id') for log in data['logs'][:3] if log.get('error_id')]
                        else:
                            self.log_test("Error logs list returns paginated data for admin", False, 
                                        f"Missing required fields in response: {list(data.keys())}")
                    except json.JSONDecodeError:
                        self.log_test("Error logs list returns paginated data for admin", False, 
                                    "Response is not valid JSON")
                else:
                    self.log_test("Error logs list returns paginated data for admin", False, 
                                f"Expected 200, got {response.status_code}")
            except Exception as e:
                self.log_test("Error logs list returns paginated data for admin", False, str(e))

    def test_error_logs_stats_admin_only(self):
        """Test GET /api/error-logs/stats returns aggregated stats (admin-only)"""
        print("\n🔍 Testing error logs stats endpoint...")
        
        if self.admin_token:
            try:
                headers = {'Authorization': f'Bearer {self.admin_token}'}
                response = self.session.get(f"{self.base_url}/api/error-logs/stats", headers=headers)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        required_fields = ['total', 'last_24h', 'last_7d', 'unresolved', 'top_errors', 'top_routes', 'top_boundaries']
                        missing_fields = [field for field in required_fields if field not in data]
                        
                        if not missing_fields:
                            self.log_test("Error logs stats returns aggregated data", True)
                        else:
                            self.log_test("Error logs stats returns aggregated data", False, 
                                        f"Missing fields: {missing_fields}")
                    except json.JSONDecodeError:
                        self.log_test("Error logs stats returns aggregated data", False, 
                                    "Response is not valid JSON")
                else:
                    self.log_test("Error logs stats returns aggregated data", False, 
                                f"Expected 200, got {response.status_code}")
            except Exception as e:
                self.log_test("Error logs stats returns aggregated data", False, str(e))

    def test_error_log_resolve_toggle(self):
        """Test PATCH /api/error-logs/{id}/resolve toggles resolved status"""
        print("\n🔍 Testing error log resolve toggle...")
        
        if self.admin_token and self.test_error_ids:
            try:
                error_id = self.test_error_ids[0]
                headers = {'Authorization': f'Bearer {self.admin_token}'}
                
                # Toggle resolve status
                response = self.session.patch(
                    f"{self.base_url}/api/error-logs/{error_id}/resolve",
                    headers=headers
                )
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if 'error_id' in data and 'resolved' in data:
                            self.log_test("Error log resolve toggle works", True)
                        else:
                            self.log_test("Error log resolve toggle works", False, 
                                        f"Missing fields in response: {list(data.keys())}")
                    except json.JSONDecodeError:
                        self.log_test("Error log resolve toggle works", False, 
                                    "Response is not valid JSON")
                else:
                    self.log_test("Error log resolve toggle works", False, 
                                f"Expected 200, got {response.status_code}")
            except Exception as e:
                self.log_test("Error log resolve toggle works", False, str(e))
        else:
            self.log_test("Error log resolve toggle works", False, "No admin token or test error IDs available")

    def test_error_log_delete(self):
        """Test DELETE /api/error-logs/{id} deletes the log"""
        print("\n🔍 Testing error log deletion...")
        
        if self.admin_token and len(self.test_error_ids) > 1:
            try:
                error_id = self.test_error_ids[1]  # Use second ID to avoid conflicts
                headers = {'Authorization': f'Bearer {self.admin_token}'}
                
                # Delete the error log
                response = self.session.delete(
                    f"{self.base_url}/api/error-logs/{error_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if data.get('status') == 'deleted':
                            self.log_test("Error log deletion works", True)
                        else:
                            self.log_test("Error log deletion works", False, 
                                        f"Expected {{status: deleted}}, got {data}")
                    except json.JSONDecodeError:
                        self.log_test("Error log deletion works", False, 
                                    "Response is not valid JSON")
                else:
                    self.log_test("Error log deletion works", False, 
                                f"Expected 200, got {response.status_code}")
            except Exception as e:
                self.log_test("Error log deletion works", False, str(e))
        else:
            self.log_test("Error log deletion works", False, "No admin token or sufficient test error IDs available")

    def test_error_report_validation(self):
        """Test error report endpoint validation"""
        print("\n🔍 Testing error report validation...")
        
        # Test with missing message (should fail)
        try:
            response = self.session.post(
                f"{self.base_url}/api/error-logs/report",
                json={"stack": "some stack", "route": "/test"},
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 400:
                self.log_test("Error report validation rejects missing message", True)
            else:
                self.log_test("Error report validation rejects missing message", False, 
                            f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_test("Error report validation rejects missing message", False, str(e))

    def run_all_tests(self):
        """Run all error reporting tests"""
        print("🚀 Starting GuessIt Error Reporting System Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Login as admin first
        if not self.login_admin():
            print("❌ Cannot proceed without admin access")
            return False
        
        # Wait a bit for rate limit to reset
        print("⏳ Waiting for rate limit reset...")
        time.sleep(65)
        
        # Run all test methods
        self.test_error_report_endpoint()
        self.test_error_report_validation()
        self.test_error_report_rate_limiting()
        self.test_error_logs_list_admin_only()
        self.test_error_logs_stats_admin_only()
        self.test_error_log_resolve_toggle()
        self.test_error_log_delete()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Error Reporting Tests Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All error reporting tests passed!")
            return True
        else:
            print("⚠️  Some error reporting tests failed")
            return False

def main():
    tester = ErrorReportingTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())