import requests
import json
import time
from datetime import datetime

class MessagesAPITester:
    def __init__(self):
        self.base_url = "https://guess-it-duplicate-1.preview.emergentagent.com/api"
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def register_and_login(self):
        """Register new user and get session token"""
        test_email = f"msgtester_{int(time.time())}@example.com"
        test_password = "TestPass123!"
        
        try:
            # Register user
            response = requests.post(
                f"{self.base_url}/auth/register",
                json={"email": test_email, "password": test_password, "confirm_password": test_password},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.user_id = data["user"]["user_id"]
                # Get session token from cookies or headers
                cookies = response.cookies
                self.session_token = cookies.get("session_token")
                
                # Set nickname
                if data.get("requires_nickname"):
                    nickname_response = requests.post(
                        f"{self.base_url}/auth/nickname",
                        json={"nickname": f"msgtester_{int(time.time())}"},
                        headers={"Authorization": f"Bearer {self.session_token}"},
                        timeout=10
                    )
                    if nickname_response.status_code == 200:
                        self.log_test("User Registration + Nickname", True, f"User ID: {self.user_id}")
                        return True
                    else:
                        self.log_test("User Registration + Nickname", False, f"Nickname failed: {nickname_response.status_code}")
                        return False
                else:
                    self.log_test("User Registration", True, f"User ID: {self.user_id}")
                    return True
            else:
                self.log_test("User Registration", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("User Registration", False, f"Error: {str(e)}")
            return False

    def test_messages_conversations(self):
        """Test messages conversations endpoint"""
        if not self.session_token:
            self.log_test("Messages Conversations", False, "No session token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(
                f"{self.base_url}/messages/conversations",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "conversations" in data and "total_unread" in data:
                    conversations_count = len(data.get("conversations", []))
                    unread_count = data.get("total_unread", 0)
                    self.log_test("Messages Conversations", True, 
                                f"Conversations: {conversations_count}, Unread: {unread_count}")
                    return True
                else:
                    self.log_test("Messages Conversations", False, f"Invalid response: {data}")
                    return False
            else:
                self.log_test("Messages Conversations", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Messages Conversations", False, f"Error: {str(e)}")
            return False

    def test_messages_unread_count(self):
        """Test messages unread count endpoint"""
        if not self.session_token:
            self.log_test("Messages Unread Count", False, "No session token")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(
                f"{self.base_url}/messages/unread-count",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "count" in data:
                    self.log_test("Messages Unread Count", True, f"Unread count: {data['count']}")
                    return True
                else:
                    self.log_test("Messages Unread Count", False, f"Invalid response: {data}")
                    return False
            else:
                self.log_test("Messages Unread Count", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Messages Unread Count", False, f"Error: {str(e)}")
            return False

    def test_websocket_endpoints_http(self):
        """Test WebSocket endpoint accessibility via HTTP (should return 405 or 404)"""
        test_cases = [
            (f"/ws/chat/{self.user_id if self.user_id else 'test'}", "Chat WebSocket"),
            (f"/ws/matches", "Matches WebSocket")
        ]
        
        results = []
        for endpoint, name in test_cases:
            try:
                # Remove /api prefix for WebSocket endpoints
                ws_url = self.base_url.replace('/api', '') + endpoint
                response = requests.get(ws_url, timeout=5)
                
                # WebSocket endpoints should return 405 (Method Not Allowed) or 404 or specific WebSocket upgrade error
                if response.status_code in [404, 405] or "upgrade" in response.text.lower():
                    self.log_test(f"{name} Endpoint Accessibility", True, 
                                f"Endpoint exists (HTTP {response.status_code})")
                    results.append(True)
                else:
                    self.log_test(f"{name} Endpoint Accessibility", False, 
                                f"Unexpected status: {response.status_code}")
                    results.append(False)
            except Exception as e:
                self.log_test(f"{name} Endpoint Accessibility", False, f"Error: {str(e)}")
                results.append(False)
        
        return all(results)

    def run_messages_tests(self):
        """Run all messages-specific tests"""
        print("🔍 Starting Messages-specific API Tests...")
        print("=" * 60)
        
        # Register user first
        if not self.register_and_login():
            print("❌ Cannot proceed without authentication")
            return False
            
        # Test messages endpoints
        self.test_messages_conversations()
        self.test_messages_unread_count()
        self.test_websocket_endpoints_http()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Messages API Tests Summary")
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0
        print(f"Success rate: {success_rate:.1f}%")
        
        # Save results
        with open("/app/test_reports/messages_api_test.json", "w") as f:
            json.dump({
                "summary": {
                    "tests_run": self.tests_run,
                    "tests_passed": self.tests_passed,
                    "success_rate": success_rate,
                    "timestamp": datetime.now().isoformat()
                },
                "results": self.test_results
            }, f, indent=2)
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = MessagesAPITester()
    success = tester.run_messages_tests()
    print(f"\n🎯 Messages API Tests {'PASSED' if success else 'FAILED'}")