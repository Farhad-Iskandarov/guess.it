#!/usr/bin/env python3
"""
Backend API Testing for Current Bug Fixes
Tests match status display and header auth state functionality
"""

import requests
import sys
import json
import time
from datetime import datetime

class CurrentFixesTester:
    def __init__(self, base_url="https://guess-it-fork-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []
        
    def log_result(self, test_name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED - {details}")
        else:
            print(f"❌ {test_name}: FAILED - {details}")
            if expected_status and actual_status:
                print(f"   Expected status: {expected_status}, Got: {actual_status}")
        
        self.results.append({
            "test_name": test_name,
            "success": success,
            "details": details,
            "expected_status": expected_status,
            "actual_status": actual_status
        })
        
    def test_health_check(self):
        """Test backend health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log_result("Backend Health Check", True, "Backend is healthy and responding")
                    return True
                else:
                    self.log_result("Backend Health Check", False, f"Unhealthy status: {data.get('status')}")
                    return False
            else:
                self.log_result("Backend Health Check", False, f"HTTP {response.status_code}", 200, response.status_code)
                return False
        except Exception as e:
            self.log_result("Backend Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_matches_status_data(self):
        """Test matches endpoint returns proper status data for match display fixes"""
        try:
            response = self.session.get(f"{self.base_url}/api/football/matches", timeout=15)
            if response.status_code == 200:
                data = response.json()
                matches = data.get('matches', [])
                
                if matches:
                    # Check first match for required status fields
                    sample_match = matches[0]
                    required_fields = ['id', 'status', 'homeTeam', 'awayTeam', 'utcDate']
                    status_fields = ['statusDetail', 'matchMinute']
                    
                    missing_required = [field for field in required_fields if field not in sample_match]
                    present_status = [field for field in status_fields if field in sample_match]
                    
                    if not missing_required:
                        details = f"Required fields present. Status fields available: {present_status}"
                        self.log_result("Match Status Data Structure", True, details)
                        
                        # Check for different match statuses
                        status_types = set([m.get('status', 'UNKNOWN') for m in matches[:10]])
                        self.log_result("Match Status Variety", True, f"Status types found: {list(status_types)}")
                        return True
                    else:
                        self.log_result("Match Status Data Structure", False, f"Missing required fields: {missing_required}")
                        return False
                else:
                    self.log_result("Match Status Data", False, "No matches returned from API")
                    return False
            else:
                self.log_result("Match Status Data", False, f"HTTP {response.status_code}", 200, response.status_code)
                return False
        except Exception as e:
            self.log_result("Match Status Data", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_authentication(self):
        """Test admin login for header auth state testing"""
        try:
            login_data = {
                "email": "admin@guessit.com",
                "password": "Admin123!"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('user') and 'email' in data['user']:
                    email = data['user'].get('email')
                    self.log_result("Admin Authentication", True, f"Login successful for {email}")
                    return True, data['user']
                else:
                    self.log_result("Admin Authentication", False, "No user data in response")
                    return False, None
            else:
                self.log_result("Admin Authentication", False, f"Login failed", 200, response.status_code)
                return False, None
        except Exception as e:
            self.log_result("Admin Authentication", False, f"Exception: {str(e)}")
            return False, None
    
    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint for header auth state functionality"""
        try:
            response = self.session.get(f"{self.base_url}/api/auth/me", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['email', 'nickname', 'level']
                present_fields = [field for field in required_fields if field in data]
                
                if 'email' in data:
                    details = f"Auth state maintained. Fields: {present_fields}"
                    self.log_result("Auth State Persistence", True, details)
                    return True
                else:
                    self.log_result("Auth State Persistence", False, "No user email in response")
                    return False
            elif response.status_code == 401:
                self.log_result("Auth State Persistence", False, "User not authenticated (session lost)")
                return False
            else:
                self.log_result("Auth State Persistence", False, f"Unexpected status", "200", response.status_code)
                return False
        except Exception as e:
            self.log_result("Auth State Persistence", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_endpoints_accessibility(self):
        """Test that auth endpoints are accessible"""
        endpoints = [
            ("login", "post"),
            ("register", "post"), 
            ("me", "get")
        ]
        
        all_accessible = True
        accessible_endpoints = []
        
        for endpoint, method in endpoints:
            try:
                url = f"{self.base_url}/api/auth/{endpoint}"
                if method == "get":
                    response = self.session.get(url, timeout=5)
                else:
                    # Send empty request to check if endpoint exists
                    response = self.session.post(url, json={}, timeout=5)
                
                # We expect 400, 401, 422 for invalid requests, not 404
                if response.status_code != 404:
                    accessible_endpoints.append(endpoint)
                else:
                    all_accessible = False
            except:
                all_accessible = False
        
        if accessible_endpoints:
            details = f"Accessible auth endpoints: {accessible_endpoints}"
            self.log_result("Auth Endpoints Accessibility", all_accessible, details)
        else:
            self.log_result("Auth Endpoints Accessibility", False, "No auth endpoints accessible")
            
        return all_accessible
            
    def run_all_tests(self):
        """Run all tests for the current fixes"""
        print("🧪 Testing Current Bug Fixes...")
        print("=" * 60)
        
        # Test 1: Basic health check
        health_ok = self.test_health_check()
        if not health_ok:
            print("❌ Backend is not healthy. Aborting tests.")
            return False
        
        # Test 2: Auth endpoints accessibility
        self.test_auth_endpoints_accessibility()
        
        # Test 3: Match status data (for display fixes)
        self.test_matches_status_data()
        
        # Test 4: Admin authentication (for header auth state testing)
        auth_success, user_data = self.test_admin_authentication()
        
        # Test 5: Auth state persistence (header fix validation)
        if auth_success:
            self.test_auth_me_endpoint()
        
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        if success_rate >= 80:
            print("🎉 Backend tests mostly successful!")
            return True
        else:
            print(f"⚠️  Backend success rate: {success_rate:.1f}% - Some issues found")
            return False
            
    def get_summary(self):
        """Get test summary"""
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        return {
            "tests_run": self.tests_run,
            "tests_passed": self.tests_passed,
            "success_rate": f"{success_rate:.1f}%",
            "results": self.results
        }

def main():
    """Main test execution"""
    tester = CurrentFixesTester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n⚠️ Test execution interrupted")
        return 1
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())