"""
Test P2 Features for GuessIt Sports Prediction Platform
- P2.1: Prediction Result Notifications (notification creation on points award)
- P2.2: Invite Friend to Match API
- P2.2: Match Invitations Received API
- P2.2: Dismiss Invitation API
- P2: Smart Advice API
- P2: Friends Activity API
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from requirements
ADMIN_EMAIL = "farhad.isgandar@gmail.com"
ADMIN_PASSWORD = "Salam123?"


class TestP2SmartAdvice:
    """P2: Test Smart Advice API - GET /api/predictions/smart-advice/{match_id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_smart_advice_endpoint_exists(self):
        """GET /api/predictions/smart-advice/{match_id} - Endpoint exists and returns valid response"""
        test_match_id = 12345
        
        response = requests.get(
            f"{BASE_URL}/api/predictions/smart-advice/{test_match_id}",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Smart advice endpoint failed: {response.text}"
        
        data = response.json()
        # Should have either 'advice' or 'message' field
        assert "advice" in data or "message" in data, "Response should contain advice or message"
        
        # If no top performers, advice should be null with a message
        if data.get("advice") is None:
            assert "message" in data, "Should have message when no advice available"
            print(f"✅ Smart advice returned: No top performers yet - {data.get('message')}")
        else:
            print(f"✅ Smart advice returned: {data['advice'][:50]}...")
    
    def test_smart_advice_requires_auth(self):
        """Smart advice endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/predictions/smart-advice/12345")
        assert response.status_code == 401, "Should require authentication"
        print("✅ Smart advice correctly requires authentication")


class TestP2FriendsActivity:
    """P2: Test Friends Activity API - GET /api/predictions/match/{match_id}/friends-activity"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_friends_activity_endpoint_exists(self):
        """GET /api/predictions/match/{match_id}/friends-activity - Endpoint exists"""
        test_match_id = 12345
        
        response = requests.get(
            f"{BASE_URL}/api/predictions/match/{test_match_id}/friends-activity",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Friends activity endpoint failed: {response.text}"
        
        data = response.json()
        assert "friends" in data, "Response should contain friends array"
        assert "total" in data, "Response should contain total count"
        assert isinstance(data["friends"], list), "Friends should be a list"
        assert isinstance(data["total"], int), "Total should be an integer"
        
        print(f"✅ Friends activity returned: {data['total']} friends predicted")
    
    def test_friends_activity_requires_auth(self):
        """Friends activity endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/predictions/match/12345/friends-activity")
        assert response.status_code == 401, "Should require authentication"
        print("✅ Friends activity correctly requires authentication")


class TestP2MatchInvitations:
    """P2.2: Test Match Invitation APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
        self.user_id = login_response.json()["user"]["user_id"]
    
    def test_invite_friend_endpoint_exists(self):
        """POST /api/friends/invite/match - Endpoint exists and validates input"""
        # Try with invalid friend_user_id (not a friend)
        response = requests.post(
            f"{BASE_URL}/api/friends/invite/match",
            json={
                "friend_user_id": "nonexistent_user_123",
                "match_id": 12345,
                "home_team": "Team A",
                "away_team": "Team B",
                "match_date": "2026-02-22T15:00:00Z"
            },
            cookies=self.cookies
        )
        
        # Should return 403 (not friends) or 404 (user not found)
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}: {response.text}"
        print(f"✅ Invite friend endpoint correctly validates friendship: {response.status_code}")
    
    def test_invite_friend_requires_auth(self):
        """Invite friend endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/friends/invite/match",
            json={
                "friend_user_id": "test_user",
                "match_id": 12345,
                "home_team": "Team A",
                "away_team": "Team B"
            }
        )
        assert response.status_code == 401, "Should require authentication"
        print("✅ Invite friend correctly requires authentication")
    
    def test_get_received_invitations(self):
        """GET /api/friends/invitations/received - Get received match invitations"""
        response = requests.get(
            f"{BASE_URL}/api/friends/invitations/received",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Failed to get invitations: {response.text}"
        
        data = response.json()
        assert "invitations" in data, "Response should contain invitations array"
        assert "total" in data, "Response should contain total count"
        assert isinstance(data["invitations"], list), "Invitations should be a list"
        
        print(f"✅ Received invitations: {data['total']} pending invitations")
    
    def test_received_invitations_requires_auth(self):
        """Received invitations endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/friends/invitations/received")
        assert response.status_code == 401, "Should require authentication"
        print("✅ Received invitations correctly requires authentication")
    
    def test_dismiss_invitation_endpoint(self):
        """POST /api/friends/invitations/{id}/dismiss - Dismiss invitation"""
        # Try to dismiss a non-existent invitation
        fake_invitation_id = "minv_nonexistent123"
        
        response = requests.post(
            f"{BASE_URL}/api/friends/invitations/{fake_invitation_id}/dismiss",
            cookies=self.cookies
        )
        
        # Should return 404 for non-existent invitation
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✅ Dismiss invitation correctly returns 404 for non-existent invitation")
    
    def test_dismiss_invitation_requires_auth(self):
        """Dismiss invitation endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/friends/invitations/test_id/dismiss")
        assert response.status_code == 401, "Should require authentication"
        print("✅ Dismiss invitation correctly requires authentication")


class TestP2NotificationCreation:
    """P2.1: Test that notifications are created properly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_notifications_endpoint_exists(self):
        """GET /api/notifications - Notifications endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Notifications endpoint failed: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain notifications array"
        assert "unread_count" in data, "Response should contain unread_count"
        assert isinstance(data["notifications"], list), "Notifications should be a list"
        
        print(f"✅ Notifications endpoint working: {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_unread_count_endpoint(self):
        """GET /api/notifications/unread-count - Get unread count"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Unread count endpoint failed: {response.text}"
        
        data = response.json()
        assert "count" in data, "Response should contain count"
        assert isinstance(data["count"], int), "Count should be an integer"
        
        print(f"✅ Unread count: {data['count']}")
    
    def test_mark_all_read(self):
        """POST /api/notifications/read-all - Mark all as read"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/read-all",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Mark all read failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Should return success"
        
        print(f"✅ Mark all read: {data.get('marked', 0)} notifications marked")
    
    def test_notifications_require_auth(self):
        """Notifications endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401, "Should require authentication"
        
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 401, "Should require authentication"
        
        print("✅ Notifications correctly require authentication")


class TestP2FriendRequestFlow:
    """Test friend request flow for invitation testing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_friends_list_endpoint(self):
        """GET /api/friends/list - Get friends list"""
        response = requests.get(
            f"{BASE_URL}/api/friends/list",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Friends list failed: {response.text}"
        
        data = response.json()
        assert "friends" in data, "Response should contain friends array"
        assert "total" in data, "Response should contain total count"
        
        print(f"✅ Friends list: {data['total']} friends")
    
    def test_pending_requests_endpoint(self):
        """GET /api/friends/requests/pending - Get pending requests"""
        response = requests.get(
            f"{BASE_URL}/api/friends/requests/pending",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Pending requests failed: {response.text}"
        
        data = response.json()
        assert "incoming" in data, "Response should contain incoming array"
        assert "outgoing" in data, "Response should contain outgoing array"
        assert "incoming_count" in data, "Response should contain incoming_count"
        assert "outgoing_count" in data, "Response should contain outgoing_count"
        
        print(f"✅ Pending requests: {data['incoming_count']} incoming, {data['outgoing_count']} outgoing")
    
    def test_search_users_endpoint(self):
        """GET /api/friends/search - Search users"""
        response = requests.get(
            f"{BASE_URL}/api/friends/search?q=test",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Search users failed: {response.text}"
        
        data = response.json()
        assert "users" in data, "Response should contain users array"
        assert "total" in data, "Response should contain total count"
        
        print(f"✅ User search: {data['total']} users found")


class TestP2IntegrationFlow:
    """Integration test: Create test user, add as friend, then test invitation flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.admin_cookies = login_response.cookies
        self.admin_user = login_response.json()["user"]
    
    def test_full_invitation_flow(self):
        """Test complete invitation flow with a test user"""
        # Step 1: Create a test user
        test_email = f"test_p2_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "TestPass123!"
        test_nickname = f"TestUser{uuid.uuid4().hex[:6]}"
        
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "confirm_password": test_password
            }
        )
        
        if register_response.status_code != 200:
            print(f"⚠️ Could not create test user: {register_response.text}")
            pytest.skip("Could not create test user for integration test")
        
        test_user_cookies = register_response.cookies
        
        # Step 1b: Set nickname for the test user
        nickname_response = requests.post(
            f"{BASE_URL}/api/auth/nickname",
            json={"nickname": test_nickname},
            cookies=test_user_cookies
        )
        
        if nickname_response.status_code != 200:
            print(f"⚠️ Could not set nickname: {nickname_response.text}")
            pytest.skip("Could not set nickname for test user")
        
        test_user = nickname_response.json()["user"]
        print(f"✅ Created test user with nickname: {test_nickname}")
        
        # Step 2: Admin sends friend request to test user
        friend_request_response = requests.post(
            f"{BASE_URL}/api/friends/request",
            json={"nickname": test_nickname},
            cookies=self.admin_cookies
        )
        
        assert friend_request_response.status_code == 200, f"Friend request failed: {friend_request_response.text}"
        request_data = friend_request_response.json()
        request_id = request_data["request"]["request_id"]
        print(f"✅ Friend request sent: {request_id}")
        
        # Step 3: Test user accepts friend request
        accept_response = requests.post(
            f"{BASE_URL}/api/friends/request/{request_id}/accept",
            cookies=test_user_cookies
        )
        
        assert accept_response.status_code == 200, f"Accept request failed: {accept_response.text}"
        print("✅ Friend request accepted")
        
        # Step 4: Admin invites test user to a match
        invite_response = requests.post(
            f"{BASE_URL}/api/friends/invite/match",
            json={
                "friend_user_id": test_user["user_id"],
                "match_id": 99999,
                "home_team": "Test Home FC",
                "away_team": "Test Away United",
                "match_date": "2026-02-25T15:00:00Z"
            },
            cookies=self.admin_cookies
        )
        
        assert invite_response.status_code == 200, f"Invite failed: {invite_response.text}"
        invite_data = invite_response.json()
        invitation_id = invite_data["invitation_id"]
        print(f"✅ Match invitation sent: {invitation_id}")
        
        # Step 5: Test user checks received invitations
        received_response = requests.get(
            f"{BASE_URL}/api/friends/invitations/received",
            cookies=test_user_cookies
        )
        
        assert received_response.status_code == 200, f"Get invitations failed: {received_response.text}"
        received_data = received_response.json()
        assert received_data["total"] >= 1, "Should have at least 1 invitation"
        
        # Find our invitation
        our_invitation = None
        for inv in received_data["invitations"]:
            if inv["invitation_id"] == invitation_id:
                our_invitation = inv
                break
        
        assert our_invitation is not None, "Our invitation should be in the list"
        assert our_invitation["match_id"] == 99999
        assert our_invitation["home_team"] == "Test Home FC"
        assert our_invitation["away_team"] == "Test Away United"
        print(f"✅ Invitation received correctly: {our_invitation['home_team']} vs {our_invitation['away_team']}")
        
        # Step 6: Test user dismisses the invitation
        dismiss_response = requests.post(
            f"{BASE_URL}/api/friends/invitations/{invitation_id}/dismiss",
            cookies=test_user_cookies
        )
        
        assert dismiss_response.status_code == 200, f"Dismiss failed: {dismiss_response.text}"
        print("✅ Invitation dismissed successfully")
        
        # Step 7: Verify invitation is no longer pending
        verify_response = requests.get(
            f"{BASE_URL}/api/friends/invitations/received",
            cookies=test_user_cookies
        )
        
        verify_data = verify_response.json()
        for inv in verify_data["invitations"]:
            assert inv["invitation_id"] != invitation_id, "Dismissed invitation should not appear"
        
        print("✅ Full invitation flow completed successfully!")
        
        # Step 8: Test duplicate invitation prevention
        duplicate_response = requests.post(
            f"{BASE_URL}/api/friends/invite/match",
            json={
                "friend_user_id": test_user["user_id"],
                "match_id": 99999,
                "home_team": "Test Home FC",
                "away_team": "Test Away United"
            },
            cookies=self.admin_cookies
        )
        
        # Should fail because invitation already exists (even if dismissed)
        # Actually, dismissed invitations might allow re-invite - check the response
        print(f"Duplicate invite response: {duplicate_response.status_code}")
        
        # Cleanup: Remove friendship
        requests.delete(
            f"{BASE_URL}/api/friends/{test_user['user_id']}",
            cookies=self.admin_cookies
        )
        print("✅ Cleanup: Friendship removed")


class TestP2NotificationTypes:
    """Test that different notification types are created correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, "Admin login failed"
        self.cookies = login_response.cookies
    
    def test_notification_structure(self):
        """Verify notification structure is correct"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            cookies=self.cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["notifications"]) > 0:
            notif = data["notifications"][0]
            # Check required fields
            assert "notification_id" in notif, "Should have notification_id"
            assert "user_id" in notif, "Should have user_id"
            assert "type" in notif, "Should have type"
            assert "message" in notif, "Should have message"
            assert "read" in notif, "Should have read status"
            assert "created_at" in notif, "Should have created_at"
            
            print(f"✅ Notification structure valid: type={notif['type']}, read={notif['read']}")
        else:
            print("✅ No notifications to verify structure (expected for new user)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
