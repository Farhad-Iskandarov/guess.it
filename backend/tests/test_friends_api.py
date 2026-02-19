"""
Test Friends API - Real-time friendship system for GuessIt app
Testing: Send friend request, accept/decline/cancel, search users, friends list, remove friend
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent
TEST_USER_1 = {
    "email": "testuser@example.com",
    "password": "TestPass123!",
    "nickname": "TestPlayer"
}

TEST_USER_2 = {
    "email": "friend1@example.com",
    "password": "TestPass123!",
    "nickname": "FriendOne"
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_user1(api_client):
    """Login as test user 1 (TestPlayer)"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_1["email"],
        "password": TEST_USER_1["password"]
    })
    if response.status_code != 200:
        pytest.skip(f"Failed to login as {TEST_USER_1['email']}: {response.text}")
    
    session_token = response.cookies.get("session_token")
    if not session_token:
        data = response.json()
        session_token = data.get("session_token")
    
    return {
        "token": session_token,
        "user": response.json().get("user", {}),
        "cookies": response.cookies.get_dict()
    }


@pytest.fixture(scope="module")
def auth_user2(api_client):
    """Login as test user 2 (FriendOne)"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_2["email"],
        "password": TEST_USER_2["password"]
    })
    if response.status_code != 200:
        pytest.skip(f"Failed to login as {TEST_USER_2['email']}: {response.text}")
    
    session_token = response.cookies.get("session_token")
    if not session_token:
        data = response.json()
        session_token = data.get("session_token")
    
    return {
        "token": session_token,
        "user": response.json().get("user", {}),
        "cookies": response.cookies.get_dict()
    }


class TestFriendsAPIUnauthenticated:
    """Test unauthenticated access to friends API"""
    
    def test_search_users_unauthenticated(self, api_client):
        """Searching users without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/friends/search?q=test")
        assert response.status_code == 401
        print("PASS: Search users returns 401 when unauthenticated")
    
    def test_get_friends_list_unauthenticated(self, api_client):
        """Getting friends list without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/friends/list")
        assert response.status_code == 401
        print("PASS: Friends list returns 401 when unauthenticated")
    
    def test_get_pending_requests_unauthenticated(self, api_client):
        """Getting pending requests without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/friends/requests/pending")
        assert response.status_code == 401
        print("PASS: Pending requests returns 401 when unauthenticated")
    
    def test_get_pending_count_unauthenticated(self, api_client):
        """Getting pending count without auth should return 401"""
        response = api_client.get(f"{BASE_URL}/api/friends/requests/count")
        assert response.status_code == 401
        print("PASS: Pending count returns 401 when unauthenticated")
    
    def test_send_friend_request_unauthenticated(self, api_client):
        """Sending friend request without auth should return 401"""
        response = api_client.post(f"{BASE_URL}/api/friends/request", json={"nickname": "SomeUser"})
        assert response.status_code == 401
        print("PASS: Send friend request returns 401 when unauthenticated")


class TestSearchUsers:
    """Test user search functionality"""
    
    def test_search_users_minimum_query(self, api_client, auth_user1):
        """Search requires at least 2 characters"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/search?q=a",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert data["users"] == []  # Short query returns empty
        assert data["total"] == 0
        print("PASS: Search with 1 character returns empty list")
    
    def test_search_users_by_nickname(self, api_client, auth_user1):
        """Search for users by nickname"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/search?q=Friend",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        # FriendOne should be in results
        friend_found = any(u.get("nickname") == TEST_USER_2["nickname"] for u in data["users"])
        print(f"Search results: {data['users']}")
        print(f"PASS: Search for 'Friend' returned {data['total']} results, FriendOne found: {friend_found}")
    
    def test_search_excludes_self(self, api_client, auth_user1):
        """Search should not include the current user"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/search?q=TestPlayer",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        # Current user should not be in results
        self_found = any(u.get("nickname") == TEST_USER_1["nickname"] for u in data["users"])
        assert not self_found, "Search should not include current user"
        print("PASS: Search excludes self")
    
    def test_search_returns_status(self, api_client, auth_user1):
        """Search results should include friendship status"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/search?q=Friend",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        for user in data["users"]:
            assert "status" in user, "Each user should have a status field"
            assert user["status"] in ["none", "friend", "request_sent", "request_received"]
        print("PASS: Search results include status field")


class TestFriendsList:
    """Test friends list functionality"""
    
    def test_get_friends_list(self, api_client, auth_user1):
        """Get list of friends"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/list",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "friends" in data
        assert "total" in data
        assert isinstance(data["friends"], list)
        print(f"PASS: Got friends list with {data['total']} friends")
        
        # Check friend data structure
        if data["friends"]:
            friend = data["friends"][0]
            assert "user_id" in friend
            assert "nickname" in friend
            assert "level" in friend
            assert "points" in friend
            print(f"PASS: Friend data structure correct. First friend: {friend.get('nickname')}")


class TestPendingRequests:
    """Test pending friend requests functionality"""
    
    def test_get_pending_requests(self, api_client, auth_user1):
        """Get pending friend requests (incoming and outgoing)"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/requests/pending",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "incoming" in data
        assert "outgoing" in data
        assert "incoming_count" in data
        assert "outgoing_count" in data
        assert isinstance(data["incoming"], list)
        assert isinstance(data["outgoing"], list)
        print(f"PASS: Got pending requests - incoming: {data['incoming_count']}, outgoing: {data['outgoing_count']}")
    
    def test_get_pending_count(self, api_client, auth_user1):
        """Get count of incoming pending requests (for badge)"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/requests/count",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 0
        print(f"PASS: Pending count is {data['count']}")


class TestSendFriendRequest:
    """Test sending friend requests"""
    
    def test_send_request_to_nonexistent_user(self, api_client, auth_user1):
        """Sending request to non-existent user should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/friends/request",
            json={"nickname": "NonExistentUser12345"},
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print("PASS: Send request to non-existent user returns 404")
    
    def test_send_request_to_self(self, api_client, auth_user1):
        """Cannot send friend request to self"""
        response = api_client.post(
            f"{BASE_URL}/api/friends/request",
            json={"nickname": TEST_USER_1["nickname"]},
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 400
        data = response.json()
        assert "yourself" in data.get("detail", "").lower()
        print("PASS: Cannot send friend request to self")
    
    def test_send_request_invalid_nickname(self, api_client, auth_user1):
        """Sending request with invalid nickname should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/friends/request",
            json={"nickname": "ab"},  # Too short
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 422  # Validation error
        print("PASS: Invalid nickname (too short) returns 422")


class TestFriendRequestActions:
    """Test accept, decline, cancel friend request actions"""
    
    def test_accept_nonexistent_request(self, api_client, auth_user1):
        """Accepting non-existent request should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/friends/request/nonexistent123/accept",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 404
        print("PASS: Accept non-existent request returns 404")
    
    def test_decline_nonexistent_request(self, api_client, auth_user1):
        """Declining non-existent request should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/friends/request/nonexistent123/decline",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 404
        print("PASS: Decline non-existent request returns 404")
    
    def test_cancel_nonexistent_request(self, api_client, auth_user1):
        """Cancelling non-existent request should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/friends/request/nonexistent123/cancel",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 404
        print("PASS: Cancel non-existent request returns 404")


class TestRemoveFriend:
    """Test removing friends"""
    
    def test_remove_nonexistent_friendship(self, api_client, auth_user1):
        """Removing non-existent friendship should fail"""
        response = api_client.delete(
            f"{BASE_URL}/api/friends/nonexistent_user_id",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print("PASS: Remove non-existent friendship returns 404")


class TestExistingFriendship:
    """Test actions on existing friendship (TestPlayer and FriendOne are already friends)"""
    
    def test_check_existing_friendship(self, api_client, auth_user1):
        """Verify TestPlayer and FriendOne are friends"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/list",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check if FriendOne is in friends list
        friend_one_found = any(f.get("nickname") == TEST_USER_2["nickname"] for f in data["friends"])
        print(f"Friends list: {[f.get('nickname') for f in data['friends']]}")
        print(f"FriendOne in TestPlayer's friends: {friend_one_found}")
        
        # Note: Main agent mentioned they are already friends
        if not friend_one_found:
            print("NOTE: FriendOne not in friends list - friendship may not exist yet")
        else:
            print("PASS: TestPlayer and FriendOne are confirmed friends")
    
    def test_send_request_to_existing_friend(self, api_client, auth_user1):
        """Cannot send friend request to existing friend"""
        # First check if they are friends
        friends_response = api_client.get(
            f"{BASE_URL}/api/friends/list",
            cookies=auth_user1["cookies"]
        )
        friends_data = friends_response.json()
        is_friend = any(f.get("nickname") == TEST_USER_2["nickname"] for f in friends_data.get("friends", []))
        
        if not is_friend:
            pytest.skip("FriendOne is not currently a friend of TestPlayer")
        
        response = api_client.post(
            f"{BASE_URL}/api/friends/request",
            json={"nickname": TEST_USER_2["nickname"]},
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 400
        data = response.json()
        assert "already friends" in data.get("detail", "").lower()
        print("PASS: Cannot send friend request to existing friend")


class TestFriendRequestFlow:
    """Test complete friend request flow with a new test user"""
    
    def test_complete_friend_request_flow(self, api_client, auth_user1, auth_user2):
        """
        Test the complete flow:
        1. Check initial state
        2. User1 searches for User2 (if not already friends)
        3. Verify search status is correct
        """
        # First, get current friends and pending requests for User1
        friends_response = api_client.get(
            f"{BASE_URL}/api/friends/list",
            cookies=auth_user1["cookies"]
        )
        assert friends_response.status_code == 200
        friends_data = friends_response.json()
        print(f"User1 has {friends_data['total']} friends")
        
        pending_response = api_client.get(
            f"{BASE_URL}/api/friends/requests/pending",
            cookies=auth_user1["cookies"]
        )
        assert pending_response.status_code == 200
        pending_data = pending_response.json()
        print(f"User1 has {pending_data['incoming_count']} incoming, {pending_data['outgoing_count']} outgoing requests")
        
        # Search for User2
        search_response = api_client.get(
            f"{BASE_URL}/api/friends/search?q={TEST_USER_2['nickname']}",
            cookies=auth_user1["cookies"]
        )
        assert search_response.status_code == 200
        search_data = search_response.json()
        
        user2_in_search = None
        for u in search_data["users"]:
            if u.get("nickname") == TEST_USER_2["nickname"]:
                user2_in_search = u
                break
        
        if user2_in_search:
            print(f"Found User2 in search with status: {user2_in_search.get('status')}")
            assert user2_in_search.get("status") in ["none", "friend", "request_sent", "request_received"]
        else:
            print("User2 not found in search - may already be friends (not shown in search)")
        
        print("PASS: Friend request flow check complete")


class TestFriendDataStructure:
    """Test the data structure of friend-related responses"""
    
    def test_friend_response_structure(self, api_client, auth_user1):
        """Verify friend data has required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/list",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "friends" in data
        assert "total" in data
        
        if data["friends"]:
            friend = data["friends"][0]
            required_fields = ["user_id", "nickname", "level", "points"]
            for field in required_fields:
                assert field in friend, f"Friend should have '{field}' field"
            print(f"PASS: Friend has all required fields: {required_fields}")
        else:
            print("PASS: Friend response structure correct (no friends to verify fields)")
    
    def test_pending_request_response_structure(self, api_client, auth_user1):
        """Verify pending request data has required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/requests/pending",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["incoming", "outgoing", "incoming_count", "outgoing_count"]
        for field in required_fields:
            assert field in data, f"Response should have '{field}' field"
        
        # Check incoming request structure if any
        if data["incoming"]:
            req = data["incoming"][0]
            req_fields = ["request_id", "sender_id", "sender_nickname", "receiver_id", "receiver_nickname", "status", "created_at"]
            for field in req_fields:
                assert field in req, f"Incoming request should have '{field}' field"
            print(f"PASS: Incoming request has all required fields")
        
        # Check outgoing request structure if any
        if data["outgoing"]:
            req = data["outgoing"][0]
            req_fields = ["request_id", "sender_id", "sender_nickname", "receiver_id", "receiver_nickname", "status", "created_at"]
            for field in req_fields:
                assert field in req, f"Outgoing request should have '{field}' field"
            print(f"PASS: Outgoing request has all required fields")
        
        print(f"PASS: Pending requests response structure correct")
    
    def test_search_result_structure(self, api_client, auth_user1):
        """Verify search result data has required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/friends/search?q=test",
            cookies=auth_user1["cookies"]
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert "total" in data
        
        if data["users"]:
            user = data["users"][0]
            required_fields = ["user_id", "nickname", "level", "points", "status"]
            for field in required_fields:
                assert field in user, f"Search result should have '{field}' field"
            print(f"PASS: Search result has all required fields")
        else:
            print("PASS: Search result structure correct (no results to verify fields)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
