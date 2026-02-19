"""
Phase 3: Notification System API Tests
Tests for notification dropdown, settings toggles, and friend event notifications

Modules tested:
- GET /api/notifications - Notification list with unread count
- POST /api/notifications/read/{id} - Mark single notification read
- POST /api/notifications/read-all - Mark all notifications read
- GET /api/notifications/unread-count - Unread count
- POST /api/settings/online-visibility - Toggle online visibility
- POST /api/settings/notification-sound - Toggle notification sounds
- GET /api/settings/preferences - Get all preferences
- Friend request/accept creates notifications
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://guess-it-enhanced.preview.emergentagent.com').rstrip('/')

# Test credentials
USER1 = {"email": "chattest1@test.com", "password": "TestPass123", "nickname": "ChatTester1"}
USER2 = {"email": "chattest2@test.com", "password": "TestPass123", "nickname": "ChatTester2"}
USER3 = {"email": "chattest3@test.com", "password": "TestPass123", "nickname": "ChatTester3"}


class TestAuthHelper:
    """Helper to get session cookies"""
    
    @staticmethod
    def login(session, email, password):
        """Login and return session with cookies"""
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        return resp.status_code == 200


class TestNotificationEndpoints:
    """Test notification REST API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        logged_in = TestAuthHelper.login(self.session, USER1["email"], USER1["password"])
        if not logged_in:
            pytest.skip("Login failed for USER1")
    
    def test_get_notifications_returns_list(self):
        """GET /api/notifications returns notifications array"""
        resp = self.session.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        print(f"OK: GET /api/notifications - {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_get_notifications_with_pagination(self):
        """GET /api/notifications supports limit and offset"""
        resp = self.session.get(f"{BASE_URL}/api/notifications?limit=5&offset=0")
        assert resp.status_code == 200
        data = resp.json()
        assert "notifications" in data
        assert len(data["notifications"]) <= 5
        print(f"OK: Pagination works - returned {len(data['notifications'])} notifications")
    
    def test_get_unread_count(self):
        """GET /api/notifications/unread-count returns count"""
        resp = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"OK: Unread count is {data['count']}")
    
    def test_mark_all_read(self):
        """POST /api/notifications/read-all marks all as read"""
        resp = self.session.post(f"{BASE_URL}/api/notifications/read-all")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") == True
        print(f"OK: Marked all notifications as read")
        
        # Verify count is 0
        count_resp = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        count_data = count_resp.json()
        assert count_data.get("count") == 0
        print(f"OK: Unread count is now 0")
    
    def test_mark_single_notification_read(self):
        """POST /api/notifications/read/{id} marks single notification"""
        # Get notifications first
        notifs_resp = self.session.get(f"{BASE_URL}/api/notifications")
        notifs = notifs_resp.json().get("notifications", [])
        
        if len(notifs) == 0:
            pytest.skip("No notifications to mark as read")
        
        notif_id = notifs[0]["notification_id"]
        resp = self.session.post(f"{BASE_URL}/api/notifications/read/{notif_id}")
        # 200 if successful, 404 if notification already marked read or not found
        assert resp.status_code in [200, 404], f"Expected 200 or 404, got {resp.status_code}"
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("success") == True
            print(f"OK: Marked notification {notif_id} as read")
        else:
            print(f"OK: Notification {notif_id} was already read (404)")
    
    def test_mark_invalid_notification_returns_404(self):
        """POST /api/notifications/read/{invalid_id} returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/notifications/read/invalid_notif_12345")
        assert resp.status_code == 404
        print(f"OK: 404 for invalid notification ID")


class TestSettingsEndpoints:
    """Test settings endpoints for privacy and notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        logged_in = TestAuthHelper.login(self.session, USER1["email"], USER1["password"])
        if not logged_in:
            pytest.skip("Login failed for USER1")
    
    def test_get_preferences(self):
        """GET /api/settings/preferences returns both settings"""
        resp = self.session.get(f"{BASE_URL}/api/settings/preferences")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") == True
        assert "data" in data
        assert "online_visibility" in data["data"]
        assert "notification_sound" in data["data"]
        print(f"OK: Preferences - visibility={data['data']['online_visibility']}, sound={data['data']['notification_sound']}")
    
    def test_toggle_online_visibility(self):
        """POST /api/settings/online-visibility toggles visibility"""
        # Get current
        current_resp = self.session.get(f"{BASE_URL}/api/settings/online-visibility")
        current = current_resp.json().get("data", {}).get("online_visibility", True)
        
        # Toggle
        new_val = not current
        resp = self.session.post(f"{BASE_URL}/api/settings/online-visibility", json={"visible": new_val})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") == True
        assert data["data"]["online_visibility"] == new_val
        print(f"OK: Toggled online visibility to {new_val}")
        
        # Verify
        verify_resp = self.session.get(f"{BASE_URL}/api/settings/online-visibility")
        verify_data = verify_resp.json()
        assert verify_data["data"]["online_visibility"] == new_val
        print(f"OK: Verified visibility is {new_val}")
        
        # Toggle back
        self.session.post(f"{BASE_URL}/api/settings/online-visibility", json={"visible": current})
    
    def test_toggle_notification_sound(self):
        """POST /api/settings/notification-sound toggles sound"""
        # Get current
        current_resp = self.session.get(f"{BASE_URL}/api/settings/notification-sound")
        current = current_resp.json().get("data", {}).get("notification_sound", True)
        
        # Toggle
        new_val = not current
        resp = self.session.post(f"{BASE_URL}/api/settings/notification-sound", json={"enabled": new_val})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") == True
        assert data["data"]["notification_sound"] == new_val
        print(f"OK: Toggled notification sound to {new_val}")
        
        # Verify
        verify_resp = self.session.get(f"{BASE_URL}/api/settings/notification-sound")
        verify_data = verify_resp.json()
        assert verify_data["data"]["notification_sound"] == new_val
        print(f"OK: Verified sound setting is {new_val}")
        
        # Toggle back
        self.session.post(f"{BASE_URL}/api/settings/notification-sound", json={"enabled": current})
    
    def test_get_online_visibility(self):
        """GET /api/settings/online-visibility returns visibility status"""
        resp = self.session.get(f"{BASE_URL}/api/settings/online-visibility")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") == True
        assert "online_visibility" in data.get("data", {})
        print(f"OK: Online visibility is {data['data']['online_visibility']}")
    
    def test_get_notification_sound(self):
        """GET /api/settings/notification-sound returns sound status"""
        resp = self.session.get(f"{BASE_URL}/api/settings/notification-sound")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") == True
        assert "notification_sound" in data.get("data", {})
        print(f"OK: Notification sound is {data['data']['notification_sound']}")


class TestFriendNotificationCreation:
    """Test that friend request/accept creates notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session1 = requests.Session()
        self.session2 = requests.Session()
        
        # Login both users
        if not TestAuthHelper.login(self.session1, USER1["email"], USER1["password"]):
            pytest.skip("Login failed for USER1")
        if not TestAuthHelper.login(self.session2, USER2["email"], USER2["password"]):
            pytest.skip("Login failed for USER2")
    
    def test_friend_request_creates_notification(self):
        """Sending friend request creates notification for receiver"""
        # Check if already friends
        friends_resp = self.session1.get(f"{BASE_URL}/api/friends/list")
        friends = friends_resp.json().get("friends", [])
        is_already_friends = any(f["nickname"] == USER2["nickname"] for f in friends)
        
        if is_already_friends:
            print("SKIP: Users already friends - cannot test friend request notification creation")
            pytest.skip("Users already friends")
        
        # Check for pending request
        pending_resp = self.session1.get(f"{BASE_URL}/api/friends/requests/pending")
        outgoing = pending_resp.json().get("outgoing", [])
        pending_to_user2 = any(r["receiver_nickname"] == USER2["nickname"] for r in outgoing)
        
        if pending_to_user2:
            print("SKIP: Pending request already exists")
            pytest.skip("Pending request already exists")
        
        # Send friend request from USER1 to USER2
        send_resp = self.session1.post(f"{BASE_URL}/api/friends/request", json={"nickname": USER2["nickname"]})
        
        if send_resp.status_code == 400:
            # Already friends or pending request
            print(f"SKIP: {send_resp.json().get('detail')}")
            pytest.skip(send_resp.json().get("detail"))
        
        assert send_resp.status_code == 200
        print("OK: Friend request sent from USER1 to USER2")
        
        # Check USER2's notifications
        notifs_resp = self.session2.get(f"{BASE_URL}/api/notifications")
        notifs = notifs_resp.json().get("notifications", [])
        
        friend_request_notifs = [n for n in notifs if n.get("type") == "friend_request"]
        assert len(friend_request_notifs) > 0, "Expected friend_request notification for USER2"
        print(f"OK: USER2 has {len(friend_request_notifs)} friend_request notification(s)")
        
        # Clean up - cancel the request
        pending_resp = self.session1.get(f"{BASE_URL}/api/friends/requests/pending")
        outgoing = pending_resp.json().get("outgoing", [])
        for req in outgoing:
            if req.get("receiver_nickname") == USER2["nickname"]:
                self.session1.post(f"{BASE_URL}/api/friends/request/{req['request_id']}/cancel")
                print(f"CLEANUP: Cancelled pending request {req['request_id']}")


class TestAuthRequirements:
    """Test that all endpoints require authentication"""
    
    def test_notifications_require_auth(self):
        """Notification endpoints return 401 without auth"""
        session = requests.Session()  # No login
        
        endpoints = [
            ("GET", "/api/notifications"),
            ("GET", "/api/notifications/unread-count"),
            ("POST", "/api/notifications/read/any_id"),
            ("POST", "/api/notifications/read-all"),
        ]
        
        for method, path in endpoints:
            if method == "GET":
                resp = session.get(f"{BASE_URL}{path}")
            else:
                resp = session.post(f"{BASE_URL}{path}")
            
            assert resp.status_code == 401, f"{method} {path} should return 401, got {resp.status_code}"
            print(f"OK: {method} {path} returns 401 without auth")
    
    def test_settings_require_auth(self):
        """Settings endpoints return 401 without auth"""
        session = requests.Session()  # No login
        
        endpoints = [
            ("GET", "/api/settings/preferences"),
            ("GET", "/api/settings/online-visibility"),
            ("POST", "/api/settings/online-visibility", {"visible": True}),
            ("GET", "/api/settings/notification-sound"),
            ("POST", "/api/settings/notification-sound", {"enabled": True}),
        ]
        
        for item in endpoints:
            method = item[0]
            path = item[1]
            body = item[2] if len(item) > 2 else {}
            
            if method == "GET":
                resp = session.get(f"{BASE_URL}{path}")
            else:
                resp = session.post(f"{BASE_URL}{path}", json=body)
            
            assert resp.status_code == 401, f"{method} {path} should return 401, got {resp.status_code}"
            print(f"OK: {method} {path} returns 401 without auth")


class TestNotificationStructure:
    """Test notification data structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        logged_in = TestAuthHelper.login(self.session, USER1["email"], USER1["password"])
        if not logged_in:
            pytest.skip("Login failed for USER1")
    
    def test_notification_has_required_fields(self):
        """Notifications have all required fields"""
        resp = self.session.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200
        notifs = resp.json().get("notifications", [])
        
        if len(notifs) == 0:
            print("SKIP: No notifications to check structure")
            pytest.skip("No notifications to verify structure")
        
        required_fields = ["notification_id", "type", "message", "read", "created_at"]
        notif = notifs[0]
        
        for field in required_fields:
            assert field in notif, f"Missing field: {field}"
        
        print(f"OK: Notification has all required fields: {required_fields}")
        print(f"    Sample: type={notif['type']}, read={notif['read']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
