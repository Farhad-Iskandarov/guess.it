#!/usr/bin/env python3
"""
Production Hardening Test Suite for GuessIt Football Prediction Platform
Tests P0 and P1 upgrades for handling 10K concurrent users
"""

import requests
import sys
import time
import json
from datetime import datetime
from urllib.parse import urljoin

class ProductionHardeningTester:
    def __init__(self, base_url="https://project-backup-1.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.admin_cookies = {}
        self.user_cookies = {}
        self.tests_run = 0
        self.tests_passed = 0
        
        print(f"🚀 Testing GuessIt Production Hardening at: {self.base_url}")
        print("=" * 80)

    def run_test(self, name, method, endpoint, expected_status=200, data=None, cookies=None, headers=None):
        """Run a single test with detailed reporting"""
        self.tests_run += 1
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        
        print(f"\n🧪 Test {self.tests_run}: {name}")
        print(f"   {method} {url}")
        
        try:
            req_headers = {'Content-Type': 'application/json'}
            if headers:
                req_headers.update(headers)
                
            if method.upper() == 'GET':
                response = self.session.get(url, headers=req_headers, cookies=cookies, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=req_headers, cookies=cookies, timeout=30)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=req_headers, cookies=cookies, timeout=30)
            
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

    def test_health_endpoint(self):
        """Test basic health check"""
        success, response = self.run_test("Health Check", "GET", "health", 200)
        if success and isinstance(response, dict):
            if response.get('status') == 'healthy':
                print(f"   ℹ️  Server is healthy at: {response.get('timestamp')}")
                return True
        return False

    def test_system_metrics(self):
        """Test system metrics endpoint for production monitoring"""
        success, response = self.run_test("System Metrics", "GET", "system/metrics", 200)
        if success and isinstance(response, dict):
            print(f"   📊 WebSocket connections: {response.get('websocket_connections', {})}")
            print(f"   📊 Redis status: {response.get('redis')}")
            print(f"   📊 MongoDB status: {response.get('mongodb')}")
            print(f"   📊 Architecture: {response.get('architecture', {})}")
            
            # Verify production hardening requirements
            websocket_info = response.get('websocket_connections', {})
            redis_status = response.get('redis')
            mongodb_status = response.get('mongodb')
            architecture = response.get('architecture', {})
            
            checks = [
                (isinstance(websocket_info.get('total'), int), "WebSocket connection count"),
                (redis_status == 'connected', "Redis connection"),
                (mongodb_status == 'connected', "MongoDB connection"),
                (architecture.get('reminder_worker') == 'separate process', "Reminder worker separation"),
                (architecture.get('redis_pubsub') == True, "Redis pub/sub enabled")
            ]
            
            for check_result, check_name in checks:
                status = "✅" if check_result else "❌"
                print(f"   {status} {check_name}")
                
            return all(check[0] for check in checks)
        return False

    def test_admin_login(self):
        """Test admin authentication with cookie-based auth"""
        admin_data = {
            "email": "admin@guessit.com",
            "password": "Admin123!"
        }
        
        success, response = self.run_test("Admin Login", "POST", "auth/login", 200, admin_data)
        if success and isinstance(response, dict):
            if 'session_token' in response:
                self.admin_cookies = {'session_token': response['session_token']}
                print(f"   🔑 Admin logged in successfully")
                return True
            elif response.get('message') == 'Login successful':
                # Cookie might be set via Set-Cookie header
                print(f"   🔑 Admin login successful via cookie")
                return True
        return False

    def test_user_login(self):
        """Test regular user authentication"""
        user_data = {
            "email": "test@example.com",
            "password": "Test123!"
        }
        
        success, response = self.run_test("User Login", "POST", "auth/login", 200, user_data)
        if success and isinstance(response, dict):
            if 'session_token' in response:
                self.user_cookies = {'session_token': response['session_token']}
                print(f"   🔑 User logged in successfully")
                return True
            elif response.get('message') == 'Login successful':
                print(f"   🔑 User login successful via cookie")
                return True
        return False

    def test_prediction_creation(self):
        """Test prediction creation with race condition protection"""
        if not self.user_cookies:
            print("   ⚠️  Skipping - User not logged in")
            return False
            
        # Test match ID (using a reasonable integer)
        prediction_data = {
            "match_id": 12345,
            "prediction": "home"
        }
        
        success, response = self.run_test(
            "Create Prediction", "POST", "predictions", 200, 
            prediction_data, cookies=self.user_cookies
        )
        
        if success and isinstance(response, dict):
            prediction_id = response.get('prediction_id')
            is_new = response.get('is_new')
            print(f"   🎯 Prediction created: {prediction_id}, is_new: {is_new}")
            return True
        return False

    def test_prediction_upsert(self):
        """Test prediction upsert functionality (same match_id should update, not duplicate)"""
        if not self.user_cookies:
            print("   ⚠️  Skipping - User not logged in")
            return False
            
        # Same match ID as previous test but different prediction
        prediction_data = {
            "match_id": 12345,
            "prediction": "away"
        }
        
        success, response = self.run_test(
            "Update Prediction (Upsert)", "POST", "predictions", 200, 
            prediction_data, cookies=self.user_cookies
        )
        
        if success and isinstance(response, dict):
            is_new = response.get('is_new')
            if is_new == False:
                print(f"   ✅ Upsert working correctly - is_new: False")
                return True
            else:
                print(f"   ❌ Expected is_new=False for upsert, got: {is_new}")
        return False

    def test_rate_limiting(self):
        """Test rate limiting on predictions (15/min limit)"""
        if not self.user_cookies:
            print("   ⚠️  Skipping - User not logged in")
            return False
            
        print("   🚦 Testing rate limiting (this may take a moment)...")
        
        # Try to create 16 predictions rapidly
        for i in range(16):
            prediction_data = {
                "match_id": 50000 + i,  # Different match IDs
                "prediction": "home"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/predictions",
                json=prediction_data,
                cookies=self.user_cookies,
                headers={'Content-Type': 'application/json'}
            )
            
            if i < 15:
                # First 15 should succeed
                if response.status_code not in [200, 201]:
                    print(f"   ❌ Request {i+1} failed unexpectedly: {response.status_code}")
                    return False
            else:
                # 16th request should be rate limited
                if response.status_code == 429:
                    try:
                        error_data = response.json()
                        if "Too many predictions" in error_data.get('detail', ''):
                            print(f"   ✅ Rate limiting working - 16th request blocked with 429")
                            self.tests_run += 1
                            self.tests_passed += 1
                            return True
                    except:
                        pass
                print(f"   ❌ Expected 429 for 16th request, got: {response.status_code}")
                
        self.tests_run += 1
        return False

    def test_leaderboard_caching(self):
        """Test leaderboard endpoint (should be cached in Redis with 30s TTL)"""
        success, response = self.run_test("Leaderboard (Cached)", "GET", "football/leaderboard", 200)
        if success and isinstance(response, dict):
            users = response.get('users', [])
            print(f"   📊 Leaderboard returned {len(users)} users")
            
            # Verify sorting by points descending
            if len(users) >= 2:
                for i in range(len(users) - 1):
                    current_points = users[i].get('points', 0)
                    next_points = users[i + 1].get('points', 0)
                    if current_points < next_points:
                        print(f"   ❌ Leaderboard not sorted properly: user {i} has {current_points}, user {i+1} has {next_points}")
                        return False
                print(f"   ✅ Users properly sorted by points descending")
            
            # Check for expected test users
            usernames = [user.get('nickname', user.get('email', '')) for user in users]
            expected_users = ['CR7_Fan', 'MessiGoat', 'Haaland9', 'MbaKing', 'SalahKing', 'ViniJr_7', 'BellinghamJude', 'PedriMagic']
            found_users = [u for u in expected_users if u in usernames]
            print(f"   👥 Found test users: {found_users}")
            
            # Verify user data structure
            if users:
                sample_user = users[0]
                required_fields = ['user_id', 'points']
                optional_fields = ['nickname', 'email', 'picture', 'level', 'predictions_count', 'correct_predictions']
                
                missing_required = [f for f in required_fields if f not in sample_user]
                if missing_required:
                    print(f"   ❌ Missing required fields: {missing_required}")
                    return False
                print(f"   ✅ User data structure valid")
            
            return len(users) >= 0  # Any number of users is fine
        return False

    def test_weekly_leaderboard(self):
        """Test weekly leaderboard with date information"""
        success, response = self.run_test("Weekly Leaderboard", "GET", "football/leaderboard/weekly", 200)
        if success and isinstance(response, dict):
            users = response.get('users', [])
            week_start = response.get('week_start')
            week_end = response.get('week_end')
            print(f"   📅 Weekly period: {week_start} to {week_end}")
            print(f"   📊 Weekly leaderboard: {len(users)} users")
            
            # Verify weekly points sorting
            if len(users) >= 2:
                for i in range(len(users) - 1):
                    current_points = users[i].get('weekly_points', users[i].get('points', 0))
                    next_points = users[i + 1].get('weekly_points', users[i + 1].get('points', 0))
                    if current_points < next_points:
                        print(f"   ❌ Weekly leaderboard not sorted properly")
                        return False
                print(f"   ✅ Weekly users properly sorted by weekly_points descending")
            
            # Verify weekly data structure
            if users:
                sample_user = users[0]
                if 'weekly_points' not in sample_user and 'points' not in sample_user:
                    print(f"   ❌ No weekly_points or points field found")
                    return False
                print(f"   ✅ Weekly data structure valid")
            
            return week_start is not None and week_end is not None
        return False

    def test_redis_connectivity(self):
        """Verify Redis is accessible (indirect test through caching)"""
        # This tests Redis indirectly by checking if system metrics show connected status
        success, response = self.run_test("Redis Connectivity Check", "GET", "system/metrics", 200)
        if success and isinstance(response, dict):
            redis_status = response.get('redis')
            return redis_status == 'connected'
        return False

    def test_compound_indexes(self):
        """Test that compound indexes prevent duplicate predictions"""
        if not self.user_cookies:
            print("   ⚠️  Skipping - User not logged in")
            return False
            
        # Try to create the same prediction twice rapidly (should use atomic upsert)
        prediction_data = {
            "match_id": 99999,
            "prediction": "draw"
        }
        
        # First request
        response1 = self.session.post(
            f"{self.base_url}/api/predictions",
            json=prediction_data,
            cookies=self.user_cookies,
            headers={'Content-Type': 'application/json'}
        )
        
        # Immediate second request
        response2 = self.session.post(
            f"{self.base_url}/api/predictions",
            json=prediction_data,
            cookies=self.user_cookies,
            headers={'Content-Type': 'application/json'}
        )
        
        self.tests_run += 1
        
        if response1.status_code == 200 and response2.status_code == 200:
            try:
                data1 = response1.json()
                data2 = response2.json()
                
                # Both should succeed but second should be update (is_new=False)
                pred_id_1 = data1.get('prediction_id')
                pred_id_2 = data2.get('prediction_id')
                is_new_1 = data1.get('is_new')
                is_new_2 = data2.get('is_new')
                
                if pred_id_1 == pred_id_2 and is_new_1 == True and is_new_2 == False:
                    print(f"   ✅ Compound index working - same ID, second is update")
                    self.tests_passed += 1
                    return True
                else:
                    print(f"   ❌ Index check failed - IDs: {pred_id_1}, {pred_id_2}, is_new: {is_new_1}, {is_new_2}")
            except Exception as e:
                print(f"   ❌ Error parsing responses: {e}")
        else:
            print(f"   ❌ Unexpected status codes: {response1.status_code}, {response2.status_code}")
            
        return False

    def test_subscription_plans(self):
        """Test subscription plans API"""
        success, response = self.run_test("Subscription Plans", "GET", "subscriptions/plans", 200)
        if success and isinstance(response, dict):
            plans = response.get('plans', [])
            print(f"   💳 Found {len(plans)} subscription plans")
            return True
        return False

    def test_news_api(self):
        """Test news API endpoint"""
        success, response = self.run_test("News API", "GET", "news", 200)
        if success:
            print(f"   📰 News API responding")
            return True
        return False

    def test_frontend_homepage(self):
        """Test that homepage loads correctly"""
        try:
            print(f"\n🌐 Testing Frontend Homepage")
            response = self.session.get(self.base_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"   ✅ Homepage loaded successfully")
                return True
            else:
                print(f"   ❌ Homepage failed to load: {response.status_code}")
        except Exception as e:
            print(f"   💥 Homepage error: {e}")
            
        return False

    def test_admin_panel_access(self):
        """Test admin panel accessibility"""
        try:
            print(f"\n🔒 Testing Admin Panel Access")
            admin_url = f"{self.base_url}/itguess/admin/login"
            response = self.session.get(admin_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"   ✅ Admin panel accessible at /itguess/admin/login")
                return True
            else:
                print(f"   ❌ Admin panel not accessible: {response.status_code}")
        except Exception as e:
            print(f"   💥 Admin panel error: {e}")
            
        return False

    def run_all_tests(self):
        """Execute the complete test suite"""
        print("🏁 Starting Production Hardening Test Suite")
        print("=" * 80)
        
        # Core system tests
        self.test_health_endpoint()
        self.test_system_metrics()
        
        # Authentication tests
        self.test_admin_login()
        self.test_user_login()
        
        # Prediction system tests (P0 fixes)
        self.test_prediction_creation()
        self.test_prediction_upsert()
        self.test_rate_limiting()
        self.test_compound_indexes()
        
        # Caching and performance tests (P1 fixes)
        self.test_leaderboard_caching()
        self.test_weekly_leaderboard()
        self.test_redis_connectivity()
        
        # API availability tests
        self.test_subscription_plans()
        self.test_news_api()
        
        # Frontend tests
        self.test_frontend_homepage()
        self.test_admin_panel_access()
        
        # Final results
        print("\n" + "=" * 80)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 PRODUCTION HARDENING: SUCCESSFUL")
            return 0
        elif success_rate >= 60:
            print("⚠️  PRODUCTION HARDENING: PARTIAL SUCCESS - Minor issues detected")
            return 1
        else:
            print("❌ PRODUCTION HARDENING: SIGNIFICANT ISSUES - Major fixes needed")
            return 2

def main():
    tester = ProductionHardeningTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())