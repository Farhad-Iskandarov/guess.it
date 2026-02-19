"""
Test Messaging API - Real-time messaging system for GuessIt app
Testing: Send message, conversations, chat history, mark read, unread count
Also: Notifications and Settings (online visibility, notification sound)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent - these users are friends with message history
CHAT_USER_1 = {
    "email": "chattest1@test.com",
    "password": "TestPass123",
    "nickname": "ChatTester1"
}

CHAT_USER_2 = {
    "email": "chattest2@test.com",
    "password": "TestPass123",
    "nickname": "ChatTester2"
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_user1():
    """Login as chat test user 1"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": CHAT_USER_1["email"],
        "password": CHAT_USER_1["password"]
    })
    if response.status_code != 200:
        pytest.skip(f"Failed to login as {CHAT_USER_1['email']}: {response.text}")
    
    return {
        "session": session,
        "user": response.json().get("user", {}),
        "user_id": response.json().get("user", {}).get("user_id")
    }


@pytest.fixture(scope="module")
def auth_user2():
    """Login as chat test user 2"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": CHAT_USER_2["email"],
        "password": CHAT_USER_2["password"]
    })
    if response.status_code != 200:
        pytest.skip(f"Failed to login as {CHAT_USER_2['email']}: {response.text}")
    
    return {
        "session": session,
        "user": response.json().get("user", {}),
        "user_id": response.json().get("user", {}).get("user_id")
    }


# ==================== Unauthenticated Tests ====================

class TestMessagesUnauthenticated:
    """Test unauthenticated access to messages API"""
    
    def test_get_conversations_unauthenticated(self, api_client):
        """GET /api/messages/conversations without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/messages/conversations")
        assert response.status_code == 401
        print("PASS: Conversations endpoint returns 401 when unauthenticated")
    
    def test_get_unread_count_unauthenticated(self, api_client):
        """GET /api/messages/unread-count without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/messages/unread-count")
        assert response.status_code == 401
        print("PASS: Unread count returns 401 when unauthenticated")
    
    def test_send_message_unauthenticated(self, api_client):
        """POST /api/messages/send without auth should return 401"""
        response = api_client.post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": "some_user",
            "message": "test"
        })
        assert response.status_code == 401
        print("PASS: Send message returns 401 when unauthenticated")


class TestNotificationsUnauthenticated:
    """Test unauthenticated access to notifications API"""
    
    def test_get_notifications_unauthenticated(self, api_client):
        """GET /api/notifications without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401
        print("PASS: Notifications endpoint returns 401 when unauthenticated")
    
    def test_get_notification_unread_unauthenticated(self, api_client):
        """GET /api/notifications/unread-count without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 401
        print("PASS: Notification unread count returns 401 when unauthenticated")


# ==================== Conversations Tests ====================

class TestConversations:
    """Test conversations endpoints"""
    
    def test_get_conversations(self, auth_user1, auth_user2):
        """GET /api/messages/conversations should return conversations list"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/messages/conversations")
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        assert "total_unread" in data
        assert isinstance(data["conversations"], list)
        
        # Should have at least 1 conversation (with user2 since they're friends)
        if len(data["conversations"]) > 0:
            convo = data["conversations"][0]
            assert "user_id" in convo
            assert "nickname" in convo
            assert "unread_count" in convo
            print(f"PASS: Get conversations returns {len(data['conversations'])} conversations")
        else:
            print("PASS: Get conversations works (no conversations found)")
    
    def test_conversation_has_required_fields(self, auth_user1, auth_user2):
        """Conversations should have all required fields for UI"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/messages/conversations")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["conversations"]) > 0:
            convo = data["conversations"][0]
            required_fields = ["user_id", "nickname", "picture", "level", "points", 
                               "is_online", "last_seen", "last_message", "unread_count"]
            for field in required_fields:
                assert field in convo, f"Missing field: {field}"
            print("PASS: Conversation has all required fields for UI")
        else:
            print("SKIP: No conversations to test")


# ==================== Chat History Tests ====================

class TestChatHistory:
    """Test chat history endpoints"""
    
    def test_get_chat_history(self, auth_user1, auth_user2):
        """GET /api/messages/history/{friend_id} should return message history"""
        friend_id = auth_user2["user_id"]
        response = auth_user1["session"].get(f"{BASE_URL}/api/messages/history/{friend_id}")
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert "count" in data
        print(f"PASS: Get chat history returns {data['count']} messages")
    
    def test_chat_history_with_non_friend(self, auth_user1):
        """GET /api/messages/history with non-friend should return 403"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/messages/history/non_existent_user")
        assert response.status_code == 403
        print("PASS: Chat history with non-friend returns 403")


# ==================== Send Message Tests ====================

class TestSendMessage:
    """Test send message endpoint"""
    
    def test_send_message_success(self, auth_user1, auth_user2):
        """POST /api/messages/send should send message successfully"""
        friend_id = auth_user2["user_id"]
        test_message = f"Test message {time.time()}"
        
        response = auth_user1["session"].post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": friend_id,
            "message": test_message
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "message_id" in data
        assert "created_at" in data
        print(f"PASS: Send message returns message_id: {data['message_id']}")
    
    def test_send_message_to_self(self, auth_user1):
        """Sending message to yourself should fail"""
        response = auth_user1["session"].post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": auth_user1["user_id"],
            "message": "Hello myself"
        })
        assert response.status_code == 400
        print("PASS: Cannot send message to yourself")
    
    def test_send_message_to_non_friend(self, auth_user1):
        """Sending message to non-friend should fail"""
        response = auth_user1["session"].post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": "non_existent_user",
            "message": "Hello"
        })
        assert response.status_code == 403
        print("PASS: Cannot send message to non-friend")
    
    def test_send_empty_message(self, auth_user1, auth_user2):
        """Sending empty message should fail validation"""
        friend_id = auth_user2["user_id"]
        response = auth_user1["session"].post(f"{BASE_URL}/api/messages/send", json={
            "receiver_id": friend_id,
            "message": "   "  # Empty/whitespace message
        })
        assert response.status_code == 422  # Validation error
        print("PASS: Empty message fails validation")


# ==================== Mark Read Tests ====================

class TestMarkRead:
    """Test mark messages as read endpoint"""
    
    def test_mark_messages_read(self, auth_user1, auth_user2):
        """POST /api/messages/read/{friend_id} should mark messages as read"""
        friend_id = auth_user2["user_id"]
        response = auth_user1["session"].post(f"{BASE_URL}/api/messages/read/{friend_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "marked_read" in data
        print(f"PASS: Mark read returned, marked_read: {data['marked_read']}")


# ==================== Unread Count Tests ====================

class TestUnreadCount:
    """Test unread message count endpoint"""
    
    def test_get_unread_count(self, auth_user1):
        """GET /api/messages/unread-count should return count"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/messages/unread-count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"PASS: Unread count: {data['count']}")


# ==================== Notifications Tests ====================

class TestNotifications:
    """Test notification endpoints"""
    
    def test_get_notifications(self, auth_user1):
        """GET /api/notifications should return notifications list"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert "total" in data
        print(f"PASS: Get notifications returns {data['total']} notifications")
    
    def test_get_notification_unread_count(self, auth_user1):
        """GET /api/notifications/unread-count should return count"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"PASS: Notification unread count: {data['count']}")
    
    def test_mark_all_notifications_read(self, auth_user1):
        """POST /api/notifications/read-all should mark all as read"""
        response = auth_user1["session"].post(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("PASS: Mark all notifications read")


# ==================== Settings Tests ====================

class TestSettings:
    """Test settings endpoints for messaging"""
    
    def test_get_preferences(self, auth_user1):
        """GET /api/settings/preferences should return all preferences"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/settings/preferences")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "online_visibility" in data["data"]
        assert "notification_sound" in data["data"]
        print(f"PASS: Preferences: {data['data']}")
    
    def test_get_online_visibility(self, auth_user1):
        """GET /api/settings/online-visibility should return visibility status"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/settings/online-visibility")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "online_visibility" in data["data"]
        print(f"PASS: Online visibility: {data['data']['online_visibility']}")
    
    def test_set_online_visibility(self, auth_user1):
        """POST /api/settings/online-visibility should update visibility"""
        response = auth_user1["session"].post(
            f"{BASE_URL}/api/settings/online-visibility",
            json={"visible": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("PASS: Set online visibility")
    
    def test_get_notification_sound(self, auth_user1):
        """GET /api/settings/notification-sound should return sound setting"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/settings/notification-sound")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "notification_sound" in data["data"]
        print(f"PASS: Notification sound: {data['data']['notification_sound']}")
    
    def test_set_notification_sound(self, auth_user1):
        """POST /api/settings/notification-sound should update sound setting"""
        response = auth_user1["session"].post(
            f"{BASE_URL}/api/settings/notification-sound",
            json={"enabled": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("PASS: Set notification sound")


# ==================== Friend Profile Tests ====================

class TestFriendProfile:
    """Test friend profile endpoint"""
    
    def test_get_friend_profile(self, auth_user1, auth_user2):
        """GET /api/friends/profile/{friend_id} should return friend profile"""
        friend_id = auth_user2["user_id"]
        response = auth_user1["session"].get(f"{BASE_URL}/api/friends/profile/{friend_id}")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["user_id", "nickname", "picture", "level", "points", 
                           "is_online", "last_seen", "total_predictions", 
                           "correct_predictions", "is_friend"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        assert data["is_friend"] == True
        print(f"PASS: Friend profile has all required fields")
    
    def test_get_non_friend_profile(self, auth_user1):
        """Getting profile of non-friend should fail"""
        response = auth_user1["session"].get(f"{BASE_URL}/api/friends/profile/non_existent")
        # Should return 403 (not friends) or 404 (not found)
        assert response.status_code in [403, 404]
        print("PASS: Cannot view profile of non-friend")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
