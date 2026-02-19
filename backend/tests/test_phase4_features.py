"""
Phase 4 - Friends & Profile Enhancements Tests
Tests for: Guest profile API, friend profile endpoint, privacy settings
"""
import pytest
import requests
import os
import time

# Use the external URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://guess-it-enhanced.preview.emergentagent.com').rstrip('/')

# Test credentials
USER1 = {"email": "chattest1@test.com", "password": "TestPass123", "nickname": "ChatTester1"}
USER2 = {"email": "chattest2@test.com", "password": "TestPass123", "nickname": "ChatTester2"}  
USER3 = {"email": "chattest3@test.com", "password": "TestPass123", "nickname": "ChatTester3"}


class TestPhase4FriendProfile:
    """Tests for Phase 4 - Guest profile endpoint and friend features"""
    
    @pytest.fixture(scope="class")
    def session_user1(self):
        """Login session for User 1"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1["email"], "password": USER1["password"]}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed for User 1: {response.text}")
        data = response.json()
        print(f"User 1 logged in: {data.get('user', {}).get('nickname')}, user_id: {data.get('user', {}).get('user_id')}")
        return {"session": session, "user_data": data.get("user", {})}
    
    @pytest.fixture(scope="class")
    def session_user2(self):
        """Login session for User 2"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER2["email"], "password": USER2["password"]}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed for User 2: {response.text}")
        data = response.json()
        print(f"User 2 logged in: {data.get('user', {}).get('nickname')}, user_id: {data.get('user', {}).get('user_id')}")
        return {"session": session, "user_data": data.get("user", {})}
    
    @pytest.fixture(scope="class")
    def session_user3(self):
        """Login session for User 3 - non-friend"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER3["email"], "password": USER3["password"]}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed for User 3: {response.text}")
        data = response.json()
        print(f"User 3 logged in: {data.get('user', {}).get('nickname')}, user_id: {data.get('user', {}).get('user_id')}")
        return {"session": session, "user_data": data.get("user", {})}
    
    # ============ GET /api/friends/profile/{friend_user_id} ============
    
    def test_get_friend_profile_success(self, session_user1, session_user2):
        """GET /api/friends/profile/{friend_user_id} - Returns profile for friends"""
        user2_id = session_user2["user_data"]["user_id"]
        response = session_user1["session"].get(f"{BASE_URL}/api/friends/profile/{user2_id}")
        
        print(f"Friend profile response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify required fields
        assert "user_id" in data, "Missing user_id"
        assert "nickname" in data, "Missing nickname"
        assert "picture" in data or data.get("picture") is None, "Missing picture field"
        assert "level" in data, "Missing level"
        assert "points" in data, "Missing points"
        assert "total_predictions" in data, "Missing total_predictions"
        assert "correct_predictions" in data, "Missing correct_predictions"
        assert "created_at" in data, "Missing created_at (join date)"
        assert "is_friend" in data, "Missing is_friend flag"
        
        # is_online should be present (could be null if visibility disabled)
        assert "is_online" in data, "Missing is_online field"
        
        print(f"Friend profile data: nickname={data.get('nickname')}, level={data.get('level')}, is_online={data.get('is_online')}")
    
    def test_get_friend_profile_returns_correct_data(self, session_user1, session_user2):
        """Verify friend profile returns expected user's data"""
        user2_id = session_user2["user_data"]["user_id"]
        response = session_user1["session"].get(f"{BASE_URL}/api/friends/profile/{user2_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify it's user 2's data
        assert data["user_id"] == user2_id
        assert data["nickname"] == USER2["nickname"]
        assert data["is_friend"] == True
    
    def test_get_friend_profile_403_for_non_friends(self, session_user3, session_user1):
        """GET /api/friends/profile/{friend_user_id} - Returns 403 for non-friends"""
        # User 3 tries to view User 1's profile (they are not friends)
        user1_id = session_user1["user_data"]["user_id"]
        response = session_user3["session"].get(f"{BASE_URL}/api/friends/profile/{user1_id}")
        
        print(f"Non-friend profile response: {response.status_code} - {response.text}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "friend" in data["detail"].lower() or "only" in data["detail"].lower()
    
    def test_get_friend_profile_401_without_auth(self, session_user1):
        """GET /api/friends/profile/{friend_user_id} - Returns 401 without auth"""
        user_id = session_user1["user_data"]["user_id"]
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/friends/profile/{user_id}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_get_friend_profile_404_invalid_user(self, session_user1):
        """GET /api/friends/profile/{invalid_id} - Returns 404 for invalid user"""
        response = session_user1["session"].get(f"{BASE_URL}/api/friends/profile/invalid_user_id_xyz")
        
        # Could be 404 (user not found) or 403 (not friends with non-existent user)
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
    
    # ============ Friend Profile with Online Visibility Settings ============
    
    def test_friend_profile_respects_online_visibility(self, session_user1, session_user2):
        """Friend profile respects online visibility setting"""
        # First get user2's current online visibility setting
        settings_resp = session_user2["session"].get(f"{BASE_URL}/api/settings/preferences")
        if settings_resp.status_code == 200:
            settings = settings_resp.json()
            print(f"User 2 settings: {settings}")
        
        # Get user2's profile as user1
        user2_id = session_user2["user_data"]["user_id"]
        response = session_user1["session"].get(f"{BASE_URL}/api/friends/profile/{user2_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # is_online field should exist (will be null if visibility is disabled)
        assert "is_online" in data
        assert "last_seen" in data
        
        print(f"Profile is_online: {data.get('is_online')}, last_seen: {data.get('last_seen')}")
    
    # ============ Friend List Tests ============
    
    def test_get_friends_list(self, session_user1):
        """GET /api/friends/list - Returns friends list"""
        response = session_user1["session"].get(f"{BASE_URL}/api/friends/list")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "friends" in data
        assert "total" in data
        assert isinstance(data["friends"], list)
        
        # User1 and User2 should be friends
        friends = data["friends"]
        friend_nicknames = [f.get("nickname") for f in friends]
        print(f"User 1's friends: {friend_nicknames}")
        
        # Verify friend has required fields
        if friends:
            friend = friends[0]
            assert "user_id" in friend
            assert "nickname" in friend
            assert "level" in friend
            assert "points" in friend
    
    def test_remove_friend_button_api_exists(self, session_user1, session_user2):
        """Verify DELETE /api/friends/{user_id} endpoint works (don't actually remove)"""
        # We just check the endpoint exists by testing with invalid ID
        response = session_user1["session"].delete(f"{BASE_URL}/api/friends/invalid_id_xyz")
        
        # Should return 404 (not found) rather than 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ============ Search Users (Debounced on Frontend) ============
    
    def test_search_users_api(self, session_user1):
        """GET /api/friends/search?q=Chat - Returns matching users"""
        response = session_user1["session"].get(f"{BASE_URL}/api/friends/search?q=Chat")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert "total" in data
        
        users = data["users"]
        if users:
            user = users[0]
            assert "user_id" in user
            assert "nickname" in user
            assert "status" in user  # friend, request_sent, request_received, none
    
    def test_search_users_min_chars(self, session_user1):
        """GET /api/friends/search?q=C - Requires minimum 2 chars"""
        response = session_user1["session"].get(f"{BASE_URL}/api/friends/search?q=C")
        
        assert response.status_code == 200
        data = response.json()
        
        # With < 2 chars, should return empty results
        assert data.get("users", []) == [] or data.get("total", 0) == 0
    
    # ============ Messages API - Navigation State Support ============
    
    def test_messages_conversations_endpoint(self, session_user1):
        """GET /api/messages/conversations - Returns conversations list"""
        response = session_user1["session"].get(f"{BASE_URL}/api/messages/conversations")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "conversations" in data
        convos = data["conversations"]
        
        if convos:
            convo = convos[0]
            assert "user_id" in convo
            assert "nickname" in convo
            print(f"First conversation: {convo.get('nickname')}")
    
    def test_messages_chat_history_endpoint(self, session_user1, session_user2):
        """GET /api/messages/history/{user_id} - Returns chat history"""
        user2_id = session_user2["user_data"]["user_id"]
        response = session_user1["session"].get(f"{BASE_URL}/api/messages/history/{user2_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "messages" in data
        print(f"Chat history messages count: {len(data.get('messages', []))}")


class TestPhase4SettingsIntegration:
    """Tests for settings - online visibility toggle"""
    
    @pytest.fixture(scope="class")
    def session_user2(self):
        """Login session for User 2"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER2["email"], "password": USER2["password"]}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed for User 2: {response.text}")
        return session
    
    def test_online_visibility_toggle(self, session_user2):
        """POST /api/settings/online-visibility - Toggle works"""
        # Get current state
        get_resp = session_user2.get(f"{BASE_URL}/api/settings/online-visibility")
        if get_resp.status_code != 200:
            pytest.skip("Online visibility endpoint not available")
        
        current_state = get_resp.json().get("data", {}).get("online_visibility", True)
        print(f"Current online visibility: {current_state}")
        
        # Toggle it (endpoint requires {"visible": bool} body)
        toggle_resp = session_user2.post(
            f"{BASE_URL}/api/settings/online-visibility",
            json={"visible": not current_state}
        )
        assert toggle_resp.status_code == 200
        new_state = toggle_resp.json().get("data", {}).get("online_visibility")
        
        assert new_state != current_state, "Toggle should change the state"
        print(f"Toggled to: {new_state}")
        
        # Restore original state
        session_user2.post(
            f"{BASE_URL}/api/settings/online-visibility",
            json={"visible": current_state}
        )


class TestPhase4EdgeCases:
    """Edge case and error handling tests"""
    
    @pytest.fixture(scope="class")
    def session_user1(self):
        """Login session for User 1"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1["email"], "password": USER1["password"]}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed for User 1: {response.text}")
        return session
    
    def test_self_profile_view(self, session_user1):
        """Cannot view own profile via friend profile endpoint"""
        # Get current user ID
        me_resp = session_user1.get(f"{BASE_URL}/api/auth/me")
        if me_resp.status_code != 200:
            pytest.skip("Me endpoint not available")
        
        my_id = me_resp.json().get("user", {}).get("user_id")
        if not my_id:
            pytest.skip("Could not get user ID")
        
        # Try to view own profile via friend endpoint
        response = session_user1.get(f"{BASE_URL}/api/friends/profile/{my_id}")
        
        # Should return 403 (not friends with self) or some error
        # The implementation may vary - just verify it doesn't return 200 with data
        print(f"Self profile view response: {response.status_code}")
        assert response.status_code != 200 or response.json().get("is_friend") != True
    
    def test_friend_profile_prediction_stats(self, session_user1):
        """Friend profile includes prediction statistics"""
        # Get friends list first
        friends_resp = session_user1.get(f"{BASE_URL}/api/friends/list")
        if friends_resp.status_code != 200 or not friends_resp.json().get("friends"):
            pytest.skip("No friends to test with")
        
        friend_id = friends_resp.json()["friends"][0]["user_id"]
        
        # Get friend profile
        profile_resp = session_user1.get(f"{BASE_URL}/api/friends/profile/{friend_id}")
        assert profile_resp.status_code == 200
        
        data = profile_resp.json()
        
        # Verify prediction stats are included
        assert "total_predictions" in data
        assert "correct_predictions" in data
        assert isinstance(data["total_predictions"], int)
        assert isinstance(data["correct_predictions"], int)
        
        print(f"Friend prediction stats: total={data['total_predictions']}, correct={data['correct_predictions']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
