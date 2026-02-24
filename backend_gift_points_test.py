#!/usr/bin/env python3
"""
Backend API Testing - Gift Points Feature
Tests the manual user points gifting functionality in Admin Panel
"""

import requests
import sys
import json
from datetime import datetime

class GiftPointsAPITester:
    def __init__(self, base_url="https://guess-it-copy-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.users_data = []

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, cookies=None):
        """Run a single API test"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Use session cookies for authentication
        if cookies:
            self.session.cookies.update(cookies)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                pass
                
            if success:
                self.tests_passed += 1
                self.log(f"✅ Passed - Status: {response.status_code}")
                if response_data:
                    self.log(f"   Response keys: {list(response_data.keys())}")
            else:
                self.log(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response_data:
                    self.log(f"   Error: {response_data}")

            return success, response_data

        except Exception as e:
            self.log(f"❌ Failed - Exception: {str(e)}")
            return False, {}

    def admin_login(self):
        """Login as admin using provided credentials"""
        self.log("🔐 Attempting admin login...")
        
        # Attempt login using correct endpoint
        login_data = {
            "email": "farhad.isgandar@gmail.com", 
            "password": "Salam123?"
        }
        
        try:
            response = self.session.post(f"{self.base_url}/api/auth/login", json=login_data)
            self.log(f"Admin login status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                user_role = data.get("user", {}).get("role")
                
                if user_role == "admin":
                    self.log("✅ Admin login successful")
                    self.log(f"   User role: {user_role}")
                    
                    # Extract session token from response cookies
                    if 'Set-Cookie' in response.headers:
                        cookies = response.headers['Set-Cookie']
                        if 'session_token=' in cookies:
                            self.log("✅ Session cookie received")
                        else:
                            self.log("⚠️  No session token in cookies")
                    
                    return True
                else:
                    self.log(f"❌ User is not admin, role: {user_role}")
                    return False
            else:
                error_data = response.json() if response.content else {}
                self.log(f"❌ Admin login failed: {error_data}")
                return False
        except Exception as e:
            self.log(f"❌ Admin login exception: {e}")
            return False

    def test_get_users(self):
        """Test getting users list for gifting"""
        success, data = self.run_test(
            "Get Users List",
            "GET", 
            "/admin/users?page=1&limit=10&sort_by=points&sort_order=desc",
            200
        )
        
        if success and data.get('users'):
            self.users_data = data['users'][:3]  # Take first 3 users for testing
            self.log(f"   Retrieved {len(self.users_data)} users for testing")
            for user in self.users_data:
                self.log(f"   - {user.get('nickname', 'No nickname')} (ID: {user.get('user_id')}) - {user.get('points', 0)} points")
        
        return success

    def test_gift_points_validation(self):
        """Test gift points input validation"""
        
        # Test empty user list
        success1, _ = self.run_test(
            "Gift Points - Empty User List Validation",
            "POST",
            "/admin/gift-points",
            400,
            {"user_ids": [], "points": 50, "message": "Test gift"}
        )
        
        # Test negative points
        success2, _ = self.run_test(
            "Gift Points - Negative Points Validation", 
            "POST",
            "/admin/gift-points",
            400,
            {"user_ids": ["test_user"], "points": -10, "message": "Test gift"}
        )
        
        # Test zero points
        success3, _ = self.run_test(
            "Gift Points - Zero Points Validation",
            "POST", 
            "/admin/gift-points",
            400,
            {"user_ids": ["test_user"], "points": 0, "message": "Test gift"}
        )
        
        # Test exceeding max points
        success4, _ = self.run_test(
            "Gift Points - Exceeding Max Points Validation",
            "POST",
            "/admin/gift-points", 
            400,
            {"user_ids": ["test_user"], "points": 200000, "message": "Test gift"}
        )
        
        # Test non-existent user
        success5, _ = self.run_test(
            "Gift Points - Non-existent User Validation",
            "POST",
            "/admin/gift-points",
            404,
            {"user_ids": ["non_existent_user_12345"], "points": 50, "message": "Test gift"}
        )
        
        return success1 and success2 and success3 and success4 and success5

    def test_gift_points_single_user(self):
        """Test gifting points to a single user"""
        if not self.users_data:
            self.log("❌ No users available for gifting test")
            return False
            
        test_user = self.users_data[0]
        user_id = test_user['user_id']
        original_points = test_user.get('points', 0)
        gift_amount = 25
        custom_message = "Test gift for single user - automated testing"
        
        success, data = self.run_test(
            "Gift Points - Single User",
            "POST",
            "/admin/gift-points", 
            200,
            {
                "user_ids": [user_id],
                "points": gift_amount,
                "message": custom_message
            }
        )
        
        if success:
            # Check response structure
            expected_keys = ['success', 'gift_id', 'points', 'recipients', 'message', 'updated_users']
            if all(key in data for key in expected_keys):
                self.log(f"   ✅ Response has all required keys")
                self.log(f"   Gift ID: {data.get('gift_id')}")
                self.log(f"   Recipients: {data.get('recipients')}")
                
                # Check if points were updated
                updated_users = data.get('updated_users', [])
                if updated_users:
                    updated_user = updated_users[0]
                    new_points = updated_user.get('points', 0)
                    expected_points = original_points + gift_amount
                    
                    if new_points == expected_points:
                        self.log(f"   ✅ Points updated correctly: {original_points} + {gift_amount} = {new_points}")
                    else:
                        self.log(f"   ❌ Points update mismatch: expected {expected_points}, got {new_points}")
                        return False
                else:
                    self.log(f"   ❌ No updated users returned in response")
                    return False
            else:
                missing_keys = [key for key in expected_keys if key not in data]
                self.log(f"   ❌ Missing response keys: {missing_keys}")
                return False
        
        return success

    def test_gift_points_multiple_users(self):
        """Test gifting points to multiple users"""
        if len(self.users_data) < 2:
            self.log("❌ Need at least 2 users for multi-user gifting test")
            return False
            
        test_users = self.users_data[:2]  # Take first 2 users
        user_ids = [user['user_id'] for user in test_users]
        gift_amount = 15
        default_message = ""  # Test default message
        
        success, data = self.run_test(
            "Gift Points - Multiple Users",
            "POST",
            "/admin/gift-points",
            200, 
            {
                "user_ids": user_ids,
                "points": gift_amount,
                "message": default_message
            }
        )
        
        if success:
            expected_recipients = len(user_ids)
            actual_recipients = data.get('recipients', 0)
            
            if actual_recipients == expected_recipients:
                self.log(f"   ✅ Correct recipient count: {actual_recipients}")
            else:
                self.log(f"   ❌ Recipient count mismatch: expected {expected_recipients}, got {actual_recipients}")
                return False
                
            # Check for default message
            message = data.get('message', '')
            expected_default = f"You have received {gift_amount} bonus points as a Gift"
            if message == expected_default:
                self.log(f"   ✅ Default message used correctly")
            else:
                self.log(f"   ❌ Message mismatch: expected '{expected_default}', got '{message}'")
                return False
                
            # Check updated users
            updated_users = data.get('updated_users', [])
            if len(updated_users) == expected_recipients:
                self.log(f"   ✅ All users updated in response")
            else:
                self.log(f"   ❌ Updated users count mismatch: expected {expected_recipients}, got {len(updated_users)}")
                return False
        
        return success

    def test_gift_points_audit_log(self):
        """Test retrieving gift points audit log"""
        success, data = self.run_test(
            "Get Gift Points Audit Log",
            "GET",
            "/admin/gift-points/log?page=1&limit=10",
            200
        )
        
        if success:
            expected_keys = ['gifts', 'total', 'page']
            if all(key in data for key in expected_keys):
                self.log(f"   ✅ Audit log has all required keys")
                
                gifts = data.get('gifts', [])
                if gifts:
                    # Check structure of first gift log entry
                    first_gift = gifts[0]
                    expected_gift_keys = ['gift_id', 'admin_id', 'admin_nickname', 'user_ids', 'user_count', 'points', 'message', 'created_at']
                    
                    if all(key in first_gift for key in expected_gift_keys):
                        self.log(f"   ✅ Gift log entry has correct structure")
                        self.log(f"   Recent gift: {first_gift.get('points')} pts to {first_gift.get('user_count')} users")
                    else:
                        missing_keys = [key for key in expected_gift_keys if key not in first_gift]
                        self.log(f"   ❌ Gift entry missing keys: {missing_keys}")
                        return False
                else:
                    self.log(f"   ✅ Audit log retrieved (empty - no gifts yet)")
            else:
                missing_keys = [key for key in expected_keys if key not in data]
                self.log(f"   ❌ Audit log missing keys: {missing_keys}")
                return False
        
        return success

    def run_all_tests(self):
        """Run all gift points tests"""
        self.log("🚀 Starting Gift Points API Testing")
        self.log(f"Backend URL: {self.base_url}")
        
        # Admin authentication
        if not self.admin_login():
            self.log("❌ Admin login failed - cannot proceed with tests")
            return 1
            
        # Get users for testing
        if not self.test_get_users():
            self.log("❌ Failed to get users - cannot proceed with gift tests")
            return 1
            
        # Test validation
        self.test_gift_points_validation()
        
        # Test single user gifting
        self.test_gift_points_single_user()
        
        # Test multiple user gifting
        self.test_gift_points_multiple_users()
        
        # Test audit log
        self.test_gift_points_audit_log()
        
        # Results
        self.log(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All gift points tests passed!")
            return 0
        else:
            self.log(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = GiftPointsAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())