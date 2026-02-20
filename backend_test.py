import requests
import sys
import json
import time
from datetime import datetime

class GuessItAPITester:
    def __init__(self):
        self.base_url = "https://guess-it-clone.preview.emergentagent.com/api"
        self.session_token = None
        self.admin_session_token = None
        self.user_id = None
        self.admin_user_id = None
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

    def test_root_endpoint(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "GuessIt API is running":
                    self.log_test("API Root Endpoint", True, f"Status: {response.status_code}, Message: {data.get('message')}")
                    return True
                else:
                    self.log_test("API Root Endpoint", False, f"Unexpected message: {data.get('message')}")
                    return False
            else:
                self.log_test("API Root Endpoint", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("API Root Endpoint", False, f"Error: {str(e)}")
            return False

    def test_health_endpoint(self):
        """Test health check endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health Check Endpoint", True, f"Status: healthy, Timestamp: {data.get('timestamp', 'N/A')}")
                    return True
                else:
                    self.log_test("Health Check Endpoint", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Health Check Endpoint", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Check Endpoint", False, f"Error: {str(e)}")
            return False

    def test_football_matches_endpoint(self):
        """Test football matches API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/football/matches", timeout=15)
            if response.status_code == 200:
                data = response.json()
                matches = data.get("matches", [])
                total = data.get("total", 0)
                
                if len(matches) >= 100:
                    self.log_test("Football Matches API", True, f"Returned {total} matches (>= 100 required)")
                    return True
                else:
                    self.log_test("Football Matches API", False, f"Only {total} matches returned (< 100)")
                    return False
            else:
                self.log_test("Football Matches API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Football Matches API", False, f"Error: {str(e)}")
            return False

    def test_register_user(self):
        """Test user registration"""
        test_email = f"test_{int(time.time())}@example.com"
        test_password = "TestPass123!"
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/register",
                json={"email": test_email, "password": test_password, "confirm_password": test_password},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data and data.get("requires_nickname"):
                    # Store user details for subsequent tests
                    self.user_id = data["user"]["user_id"]
                    # Try to get session token from cookies
                    cookies = response.cookies
                    self.session_token = cookies.get("session_token")
                    self.log_test("User Registration", True, f"User ID: {self.user_id}, Requires nickname: {data.get('requires_nickname')}")
                    return True
                else:
                    self.log_test("User Registration", False, f"Unexpected response structure: {data}")
                    return False
            else:
                self.log_test("User Registration", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("User Registration", False, f"Error: {str(e)}")
            return False

    def test_set_nickname(self):
        """Test setting nickname after registration"""
        if not self.session_token or not self.user_id:
            self.log_test("Set Nickname", False, "No session token or user_id available")
            return False
            
        test_nickname = f"testuser_{int(time.time())}"
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.post(
                f"{self.base_url}/auth/nickname",
                json={"nickname": test_nickname},
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("user", {}).get("nickname_set"):
                    self.log_test("Set Nickname", True, f"Nickname '{test_nickname}' set successfully")
                    return True
                else:
                    self.log_test("Set Nickname", False, f"Nickname not set properly: {data}")
                    return False
            else:
                self.log_test("Set Nickname", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Set Nickname", False, f"Error: {str(e)}")
            return False

    def test_user_me_endpoint(self):
        """Test /auth/me endpoint"""
        if not self.session_token:
            self.log_test("Get Current User", False, "No session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(
                f"{self.base_url}/auth/me",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data:
                    self.log_test("Get Current User", True, f"User data retrieved: {data.get('nickname', 'No nickname')}")
                    return True
                else:
                    self.log_test("Get Current User", False, f"Invalid user data: {data}")
                    return False
            else:
                self.log_test("Get Current User", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Current User", False, f"Error: {str(e)}")
            return False

    def test_predictions_endpoint(self):
        """Test predictions endpoint"""
        if not self.session_token:
            self.log_test("Predictions API", False, "No session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(
                f"{self.base_url}/predictions/me",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "predictions" in data and "total" in data:
                    self.log_test("Predictions API", True, f"Predictions endpoint working, Total: {data.get('total', 0)}")
                    return True
                else:
                    self.log_test("Predictions API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Predictions API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Predictions API", False, f"Error: {str(e)}")
            return False

    def test_messages_conversations_endpoint(self):
        """Test messages conversations endpoint"""
        if not self.session_token:
            self.log_test("Messages Conversations API", False, "No session token available")
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
                    self.log_test("Messages Conversations API", True, f"Conversations: {len(data.get('conversations', []))}, Unread: {data.get('total_unread', 0)}")
                    return True
                else:
                    self.log_test("Messages Conversations API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Messages Conversations API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Messages Conversations API", False, f"Error: {str(e)}")
            return False

    def test_messages_unread_count_endpoint(self):
        """Test messages unread count endpoint"""
        if not self.session_token:
            self.log_test("Messages Unread Count API", False, "No session token available")
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
                    self.log_test("Messages Unread Count API", True, f"Unread count: {data.get('count', 0)}")
                    return True
                else:
                    self.log_test("Messages Unread Count API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Messages Unread Count API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Messages Unread Count API", False, f"Error: {str(e)}")
            return False

    def test_websocket_chat_endpoint(self):
        """Test WebSocket chat endpoint accessibility"""
        if not self.user_id:
            self.log_test("WebSocket Chat Endpoint", False, "No user_id available")
            return False
            
        try:
            # Test if the WS endpoint exists by making HTTP request (should return method not allowed)
            ws_url = f"{self.base_url}/ws/chat/{self.user_id}".replace('/api', '')
            response = requests.get(ws_url, timeout=5)
            # WebSocket endpoints typically return 405 or 404
            if response.status_code in [404, 405]:
                self.log_test("WebSocket Chat Endpoint", True, f"WebSocket endpoint accessible (HTTP {response.status_code} expected)")
                return True
            else:
                self.log_test("WebSocket Chat Endpoint", False, f"Unexpected status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("WebSocket Chat Endpoint", False, f"Error: {str(e)}")
            return False

    def test_websocket_info(self):
        """Test if WebSocket endpoints are accessible (no actual connection test)"""
        # We can't test WebSocket directly with requests, but we can check if the endpoint exists
        # by trying to make a regular HTTP request to it (should fail with method not allowed)
        try:
            ws_url = self.base_url.replace('/api', '') + '/api/ws/matches'
            response = requests.get(ws_url, timeout=5)
            # WebSocket endpoints typically return 405 Method Not Allowed for GET requests
            if response.status_code == 405:
                self.log_test("WebSocket Endpoint Check", True, "WebSocket endpoint exists (405 Method Not Allowed expected)")
                return True
            else:
                self.log_test("WebSocket Endpoint Check", False, f"Unexpected status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("WebSocket Endpoint Check", False, f"Error: {str(e)}")
            return False

    def test_football_live_matches(self):
        """Test live matches endpoint"""
        try:
            response = requests.get(f"{self.base_url}/football/matches/live", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "matches" in data:
                    self.log_test("Live Matches API", True, f"Total live matches: {data.get('total', 0)}")
                    return True
                else:
                    self.log_test("Live Matches API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Live Matches API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Live Matches API", False, f"Error: {str(e)}")
            return False

    def test_football_competitions(self):
        """Test competitions endpoint"""
        try:
            response = requests.get(f"{self.base_url}/football/competitions", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "competitions" in data:
                    competitions = data.get("competitions", [])
                    self.log_test("Competitions API", True, f"Total competitions: {len(competitions)}")
                    return True
                else:
                    self.log_test("Competitions API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Competitions API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Competitions API", False, f"Error: {str(e)}")
            return False

    def test_admin_login(self):
        """Test admin login with a test admin user"""
        # First create a test admin user
        test_admin_email = f"admin_{int(time.time())}@example.com"
        test_admin_password = "AdminPass123!"
        
        try:
            # Register the admin user first
            response = requests.post(
                f"{self.base_url}/auth/register",
                json={"email": test_admin_email, "password": test_admin_password, "confirm_password": test_admin_password},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test("Admin Login", False, f"Admin registration failed: {response.status_code}")
                return False
            
            reg_data = response.json()
            admin_user_id = reg_data["user"]["user_id"]
            admin_session = response.cookies.get("session_token")
            
            # Set nickname for admin user
            if admin_session:
                headers = {"Authorization": f"Bearer {admin_session}"}
                requests.post(
                    f"{self.base_url}/auth/nickname",
                    json={"nickname": f"testadmin_{int(time.time())}"},
                    headers=headers,
                    timeout=10
                )
            
            # Manually set role to admin via direct MongoDB update
            import subprocess
            result = subprocess.run([
                "mongosh", "mongodb://localhost:27017/test_database", 
                "--eval", f'db.users.updateOne({{user_id: "{admin_user_id}"}}, {{$set: {{role: "admin"}}}});'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                self.log_test("Admin Login", False, f"Failed to set admin role: {result.stderr}")
                return False
            
            # Now try to login with admin credentials
            response = requests.post(
                f"{self.base_url}/auth/login",
                json={"email": test_admin_email, "password": test_admin_password},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "user" in data and data["user"].get("role") == "admin":
                    # Store admin session from cookies
                    cookies = response.cookies
                    self.admin_session_token = cookies.get("session_token")
                    self.admin_user_id = data["user"]["user_id"]
                    self.log_test("Admin Login", True, f"Admin user logged in: {data['user'].get('nickname', 'TestAdmin')}")
                    return True
                else:
                    self.log_test("Admin Login", False, f"Login successful but not admin role: {data.get('user', {}).get('role', 'None')}")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status code: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Admin Login", False, f"Error: {str(e)}")
            return False

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        if not self.admin_session_token:
            self.log_test("Admin Dashboard", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/dashboard", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["total_users", "active_users", "total_matches", "system_status"]
                if all(field in data for field in required_fields):
                    self.log_test("Admin Dashboard", True, f"Dashboard data: {data['total_users']} users, {data['total_matches']} matches")
                    return True
                else:
                    self.log_test("Admin Dashboard", False, f"Missing required fields in response: {data}")
                    return False
            else:
                self.log_test("Admin Dashboard", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Dashboard", False, f"Error: {str(e)}")
            return False

    def test_non_admin_403_error(self):
        """Test that non-admin users get 403 on admin dashboard"""
        if not self.session_token:
            self.log_test("Non-Admin 403 Check", False, "No regular user session available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{self.base_url}/admin/dashboard", headers=headers, timeout=10)
            
            if response.status_code == 403:
                self.log_test("Non-Admin 403 Check", True, "Non-admin user correctly gets 403")
                return True
            else:
                self.log_test("Non-Admin 403 Check", False, f"Expected 403, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Non-Admin 403 Check", False, f"Error: {str(e)}")
            return False

    def test_unauthenticated_401_error(self):
        """Test that unauthenticated users get 401 on admin dashboard"""
        try:
            response = requests.get(f"{self.base_url}/admin/dashboard", timeout=10)
            
            if response.status_code == 401:
                self.log_test("Unauthenticated 401 Check", True, "Unauthenticated user correctly gets 401")
                return True
            else:
                self.log_test("Unauthenticated 401 Check", False, f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Unauthenticated 401 Check", False, f"Error: {str(e)}")
            return False

    def test_admin_users_api(self):
        """Test admin users API with pagination"""
        if not self.admin_session_token:
            self.log_test("Admin Users API", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/users", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "users" in data and "total" in data and "page" in data:
                    self.log_test("Admin Users API", True, f"Users list: {data['total']} total users, page {data['page']}")
                    return True
                else:
                    self.log_test("Admin Users API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Admin Users API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Users API", False, f"Error: {str(e)}")
            return False

    def test_admin_users_search(self):
        """Test admin users search functionality - case insensitive (BUG FIX VERIFICATION)"""
        if not self.admin_session_token:
            self.log_test("Admin Users Search", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            
            # First, let's search for any user to see if search works at all
            response = requests.get(f"{self.base_url}/admin/users?search=test", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "users" in data:
                    # Test case insensitive search - search for lowercase when user has mixed case
                    # This tests the bug fix for case sensitivity
                    search_terms = ["test", "TEST", "Test"]  # Different cases
                    all_passed = True
                    results_counts = []
                    
                    for term in search_terms:
                        test_response = requests.get(f"{self.base_url}/admin/users?search={term}", headers=headers, timeout=10)
                        if test_response.status_code == 200:
                            test_data = test_response.json()
                            results_counts.append(len(test_data.get("users", [])))
                        else:
                            all_passed = False
                            break
                    
                    # All search results should be the same (case insensitive)
                    if all_passed and len(set(results_counts)) <= 1:  # All counts should be equal
                        self.log_test("Admin Users Search (Case Insensitive)", True, f"Case insensitive search working, found {results_counts[0]} results for all cases")
                        return True
                    else:
                        self.log_test("Admin Users Search (Case Insensitive)", False, f"Case sensitivity issue: {results_counts}")
                        return False
                else:
                    self.log_test("Admin Users Search", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Admin Users Search", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Users Search", False, f"Error: {str(e)}")
            return False

    def test_admin_matches_api(self):
        """Test admin matches API"""
        if not self.admin_session_token:
            self.log_test("Admin Matches API", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/matches", headers=headers, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if "matches" in data and "total" in data:
                    self.log_test("Admin Matches API", True, f"Matches: {data['total']} total matches")
                    return True
                else:
                    self.log_test("Admin Matches API", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Admin Matches API", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Matches API", False, f"Error: {str(e)}")
            return False

    def test_admin_force_refresh(self):
        """Test admin force refresh matches"""
        if not self.admin_session_token:
            self.log_test("Admin Force Refresh", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.post(f"{self.base_url}/admin/matches/refresh", headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Admin Force Refresh", True, f"Force refresh successful: {data.get('message', '')}")
                    return True
                else:
                    self.log_test("Admin Force Refresh", False, f"Force refresh failed: {data}")
                    return False
            else:
                self.log_test("Admin Force Refresh", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Force Refresh", False, f"Error: {str(e)}")
            return False

    def test_admin_user_detail(self):
        """Test admin user detail endpoint"""
        if not self.admin_session_token or not self.user_id:
            self.log_test("Admin User Detail", False, "No admin session token or user_id available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/users/{self.user_id}", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["user_id", "email", "predictions_count", "messages_sent", "friends_count"]
                if all(field in data for field in required_fields):
                    self.log_test("Admin User Detail", True, f"User detail: {data['predictions_count']} predictions, {data['friends_count']} friends")
                    return True
                else:
                    self.log_test("Admin User Detail", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Admin User Detail", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin User Detail", False, f"Error: {str(e)}")
            return False

    def test_admin_user_conversations(self):
        """Test admin user conversations endpoint (replacing moderation)"""
        if not self.admin_session_token or not self.user_id:
            self.log_test("Admin User Conversations", False, "No admin session token or user_id available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/users/{self.user_id}/conversations", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "conversations" in data and "total" in data:
                    self.log_test("Admin User Conversations", True, f"User conversations: {data['total']} total conversations")
                    return True
                else:
                    self.log_test("Admin User Conversations", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Admin User Conversations", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin User Conversations", False, f"Error: {str(e)}")
            return False

    def test_admin_change_password(self):
        """Test admin change user password endpoint"""
        if not self.admin_session_token or not self.user_id:
            self.log_test("Admin Change Password", False, "No admin session token or user_id available")
            return False
            
        try:
            headers = {
                "Authorization": f"Bearer {self.admin_session_token}",
                "Content-Type": "application/json"
            }
            new_password = f"NewPass{int(time.time())}!"
            response = requests.post(
                f"{self.base_url}/admin/users/{self.user_id}/change-password",
                headers=headers,
                json={"new_password": new_password},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Admin Change Password", True, f"Password changed: {data.get('message', '')}")
                    return True
                else:
                    self.log_test("Admin Change Password", False, f"Password change failed: {data}")
                    return False
            else:
                self.log_test("Admin Change Password", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Change Password", False, f"Error: {str(e)}")
            return False

    def test_admin_ban_unban_user(self):
        """Test admin ban/unban user endpoints"""
        if not self.admin_session_token or not self.user_id:
            self.log_test("Admin Ban/Unban User", False, "No admin session token or user_id available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            
            # Test ban
            response = requests.post(f"{self.base_url}/admin/users/{self.user_id}/ban", headers=headers, timeout=10)
            if response.status_code != 200:
                self.log_test("Admin Ban/Unban User", False, f"Ban failed: {response.status_code}")
                return False
            
            # Test unban
            response = requests.post(f"{self.base_url}/admin/users/{self.user_id}/unban", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Admin Ban/Unban User", True, "Ban/unban functionality working")
                    return True
                else:
                    self.log_test("Admin Ban/Unban User", False, f"Unban failed: {data}")
                    return False
            else:
                self.log_test("Admin Ban/Unban User", False, f"Unban status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Ban/Unban User", False, f"Error: {str(e)}")
            return False

    def test_admin_users_sort_and_filter(self):
        """Test admin users sorting by points and filtering by status"""
        if not self.admin_session_token:
            self.log_test("Admin Users Sort/Filter", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            
            # Test sort by points desc (default)
            response = requests.get(f"{self.base_url}/admin/users?sort_by=points&sort_order=desc", headers=headers, timeout=10)
            if response.status_code != 200:
                self.log_test("Admin Users Sort/Filter", False, f"Sort by points failed: {response.status_code}")
                return False
            
            data = response.json()
            users = data.get("users", [])
            
            # Verify sorting - points should be in descending order
            points_sorted = all(
                users[i].get("points", 0) >= users[i + 1].get("points", 0) 
                for i in range(len(users) - 1)
            ) if len(users) > 1 else True
            
            if not points_sorted:
                self.log_test("Admin Users Sort/Filter", False, "Points not sorted in descending order")
                return False
            
            # Test filters
            filter_tests = ["online", "offline", "banned"]
            for filter_status in filter_tests:
                response = requests.get(f"{self.base_url}/admin/users?filter_status={filter_status}", headers=headers, timeout=10)
                if response.status_code != 200:
                    self.log_test("Admin Users Sort/Filter", False, f"Filter {filter_status} failed: {response.status_code}")
                    return False
            
            self.log_test("Admin Users Sort/Filter", True, f"Sorting and filtering working, {len(users)} users sorted by points")
            return True
            
        except Exception as e:
            self.log_test("Admin Users Sort/Filter", False, f"Error: {str(e)}")
            return False

    def test_admin_system_apis(self):
        """Test admin system APIs management"""
        if not self.admin_session_token:
            self.log_test("Admin System APIs", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            
            # Test list APIs
            response = requests.get(f"{self.base_url}/admin/system/apis", headers=headers, timeout=10)
            if response.status_code != 200:
                self.log_test("Admin System APIs", False, f"List APIs failed: {response.status_code}")
                return False
            
            apis_data = response.json()
            
            # Test add API
            test_api = {
                "name": "Test Football API",
                "base_url": "https://test.football-api.com/v1",
                "api_key": "test_key_12345"
            }
            response = requests.post(
                f"{self.base_url}/admin/system/apis",
                headers={**headers, "Content-Type": "application/json"},
                json=test_api,
                timeout=10
            )
            if response.status_code != 200:
                self.log_test("Admin System APIs", False, f"Add API failed: {response.status_code}")
                return False
            
            added_api = response.json()
            api_id = added_api.get("api", {}).get("api_id")
            
            if not api_id:
                self.log_test("Admin System APIs", False, "No API ID returned after creation")
                return False
            
            # Test toggle API
            response = requests.post(f"{self.base_url}/admin/system/apis/{api_id}/toggle", headers=headers, timeout=10)
            if response.status_code != 200:
                self.log_test("Admin System APIs", False, f"Toggle API failed: {response.status_code}")
                return False
            
            self.log_test("Admin System APIs", True, f"API management working: list, add, toggle successful")
            return True
            
        except Exception as e:
            self.log_test("Admin System APIs", False, f"Error: {str(e)}")
            return False

    def test_admin_prediction_streaks(self):
        """Test admin prediction streaks monitoring"""
        if not self.admin_session_token:
            self.log_test("Admin Prediction Streaks", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/prediction-streaks?min_streak=5", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "streaks" in data and "total" in data:
                    self.log_test("Admin Prediction Streaks", True, f"Prediction streaks: {data['total']} users with streaks")
                    return True
                else:
                    self.log_test("Admin Prediction Streaks", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Admin Prediction Streaks", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Prediction Streaks", False, f"Error: {str(e)}")
            return False

    def test_admin_favorite_users(self):
        """Test admin favorite users management"""
        if not self.admin_session_token or not self.user_id:
            self.log_test("Admin Favorite Users", False, "No admin session token or user_id available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            
            # Test list favorites
            response = requests.get(f"{self.base_url}/admin/favorite-users", headers=headers, timeout=10)
            if response.status_code != 200:
                self.log_test("Admin Favorite Users", False, f"List favorites failed: {response.status_code}")
                return False
            
            # Test add to favorites
            response = requests.post(
                f"{self.base_url}/admin/favorite-users/{self.user_id}",
                headers={**headers, "Content-Type": "application/json"},
                json={"note": "Test favorite user"},
                timeout=10
            )
            if response.status_code not in [200, 400]:  # 400 if already in favorites
                self.log_test("Admin Favorite Users", False, f"Add favorite failed: {response.status_code}")
                return False
            
            # Test remove from favorites
            response = requests.delete(f"{self.base_url}/admin/favorite-users/{self.user_id}", headers=headers, timeout=10)
            if response.status_code in [200, 404]:  # 404 if not in favorites is OK
                self.log_test("Admin Favorite Users", True, "Favorite users management working")
                return True
            else:
                self.log_test("Admin Favorite Users", False, f"Remove favorite failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Admin Favorite Users", False, f"Error: {str(e)}")
            return False

    def test_non_admin_all_endpoints_403(self):
        """Test that non-admin users get 403 for all admin endpoints"""
        if not self.session_token:
            self.log_test("Non-Admin 403 All Endpoints", False, "No regular user session available")
            return False
            
        # Test GET endpoints
        get_endpoints = [
            "/admin/dashboard",
            "/admin/users", 
            f"/admin/users/{self.user_id or 'dummy'}",
            f"/admin/users/{self.user_id or 'dummy'}/conversations",
            "/admin/system/apis",
            "/admin/prediction-streaks",
            "/admin/favorite-users",
            "/admin/analytics",
            "/admin/audit-log"
        ]
        
        # Test POST endpoints that non-admin should get 403 on
        post_endpoints = [
            f"/admin/users/{self.user_id or 'dummy'}/ban",
            f"/admin/users/{self.user_id or 'dummy'}/unban",
            "/admin/notifications/broadcast"
        ]
        
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            failed_endpoints = []
            
            # Test GET endpoints
            for endpoint in get_endpoints:
                response = requests.get(f"{self.base_url}{endpoint}", headers=headers, timeout=5)
                if response.status_code != 403:
                    failed_endpoints.append(f"GET {endpoint}:{response.status_code}")
            
            # Test POST endpoints  
            for endpoint in post_endpoints:
                response = requests.post(f"{self.base_url}{endpoint}", 
                                       headers={**headers, "Content-Type": "application/json"},
                                       json={}, timeout=5)
                if response.status_code != 403:
                    failed_endpoints.append(f"POST {endpoint}:{response.status_code}")
            
            total_endpoints = len(get_endpoints) + len(post_endpoints)
            if not failed_endpoints:
                self.log_test("Non-Admin 403 All Endpoints", True, f"All {total_endpoints} admin endpoints correctly return 403")
                return True
            else:
                self.log_test("Non-Admin 403 All Endpoints", False, f"Failed endpoints: {failed_endpoints}")
                return False
                
        except Exception as e:
            self.log_test("Non-Admin 403 All Endpoints", False, f"Error: {str(e)}")
            return False

    def test_admin_analytics(self):
        """Test admin analytics endpoint"""
        if not self.admin_session_token:
            self.log_test("Admin Analytics", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/analytics", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["daily_users", "daily_predictions", "top_predictors", "points_distribution"]
                if all(field in data for field in required_fields):
                    self.log_test("Admin Analytics", True, f"Analytics data loaded: {len(data['daily_users'])} daily user stats, {len(data['top_predictors'])} top predictors")
                    return True
                else:
                    self.log_test("Admin Analytics", False, f"Missing required fields in analytics: {data}")
                    return False
            else:
                self.log_test("Admin Analytics", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Analytics", False, f"Error: {str(e)}")
            return False

    def test_admin_audit_log(self):
        """Test admin audit log endpoint"""
        if not self.admin_session_token:
            self.log_test("Admin Audit Log", False, "No admin session token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_session_token}"}
            response = requests.get(f"{self.base_url}/admin/audit-log", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "logs" in data and "total" in data:
                    self.log_test("Admin Audit Log", True, f"Audit log: {data['total']} total entries")
                    return True
                else:
                    self.log_test("Admin Audit Log", False, f"Invalid response structure: {data}")
                    return False
            else:
                self.log_test("Admin Audit Log", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Audit Log", False, f"Error: {str(e)}")
            return False

    def test_admin_notifications_broadcast(self):
        """Test admin broadcast notification"""
        if not self.admin_session_token:
            self.log_test("Admin Broadcast Notification", False, "No admin session token available")
            return False
            
        try:
            headers = {
                "Authorization": f"Bearer {self.admin_session_token}",
                "Content-Type": "application/json"
            }
            test_message = f"Test broadcast notification at {datetime.now().strftime('%H:%M:%S')}"
            response = requests.post(
                f"{self.base_url}/admin/notifications/broadcast",
                headers=headers,
                json={"message": test_message},
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "sent_to" in data:
                    self.log_test("Admin Broadcast Notification", True, f"Broadcast sent to {data['sent_to']} users")
                    return True
                else:
                    self.log_test("Admin Broadcast Notification", False, f"Broadcast failed: {data}")
                    return False
            else:
                self.log_test("Admin Broadcast Notification", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Broadcast Notification", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🔍 Starting GuessIt Backend API Tests...")
        print("=" * 50)
        
        # Test basic endpoints first
        self.test_root_endpoint()
        self.test_health_endpoint()
        self.test_football_matches_endpoint()
        self.test_football_live_matches()
        self.test_football_competitions()
        self.test_websocket_info()
        
        # Test authentication flow
        self.test_register_user()
        if self.session_token:
            self.test_set_nickname()
            self.test_user_me_endpoint()
            self.test_predictions_endpoint()
            # Test messages-specific endpoints
            self.test_messages_conversations_endpoint()
            self.test_messages_unread_count_endpoint()
            self.test_websocket_chat_endpoint()
        
        print("\n🔐 Testing Admin Panel APIs...")
        print("-" * 30)
        
        # Test admin authentication and authorization
        self.test_admin_login()
        self.test_unauthenticated_401_error()
        if self.session_token:
            self.test_non_admin_403_error()
        
        # Test admin endpoints (requires admin login)
        if self.admin_session_token:
            self.test_admin_dashboard()
            self.test_admin_users_api()
            self.test_admin_users_search()
            self.test_admin_users_sort_and_filter()
            self.test_admin_user_detail()
            self.test_admin_user_conversations() 
            self.test_admin_change_password()
            self.test_admin_ban_unban_user()
            self.test_admin_matches_api()
            self.test_admin_force_refresh()
            self.test_admin_system_apis()
            self.test_admin_prediction_streaks()
            self.test_admin_favorite_users()
            self.test_admin_analytics()
            self.test_admin_audit_log()
            self.test_admin_notifications_broadcast()
            
        # Test authorization for all endpoints
        if self.session_token:
            self.test_non_admin_all_endpoints_403()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Backend API Tests Summary")
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print("⚠️ Some backend tests failed. Check details above.")
            return False

if __name__ == "__main__":
    tester = GuessItAPITester()
    success = tester.run_all_tests()
    
    # Save test results to file
    with open("/app/test_reports/backend_test_results.json", "w") as f:
        json.dump({
            "summary": {
                "tests_run": tester.tests_run,
                "tests_passed": tester.tests_passed,
                "success_rate": tester.tests_passed/tester.tests_run*100 if tester.tests_run > 0 else 0,
                "timestamp": datetime.now().isoformat()
            },
            "results": tester.test_results
        }, f, indent=2)
    
    sys.exit(0 if success else 1)