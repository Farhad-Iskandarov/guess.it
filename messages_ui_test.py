#!/usr/bin/env python3
"""
Messages UI Test - Register users and test Messages page functionality
"""
import requests
import time
import json

class MessagesUITester:
    def __init__(self):
        self.base_url = "https://guess-it-duplicate-1.preview.emergentagent.com/api"
        self.user_a = {}
        self.user_b = {}
        
    def register_test_users(self):
        """Register two test users for messaging"""
        timestamp = int(time.time())
        
        # User A
        email_a = f"usera{timestamp}@example.com"
        password_a = "TestPass123!"
        nickname_a = f"usera{timestamp}"
        
        # User B  
        email_b = f"userb{timestamp}@example.com"
        password_b = "TestPass123!"
        nickname_b = f"userb{timestamp}"
        
        print("Registering test users...")
        
        # Register User A
        reg_a = requests.post(f"{self.base_url}/auth/register", json={
            "email": email_a, "password": password_a, "confirm_password": password_a
        })
        
        if reg_a.status_code == 200:
            token_a = reg_a.cookies.get("session_token")
            user_a_data = reg_a.json()
            
            # Set nickname for User A
            nick_a = requests.post(f"{self.base_url}/auth/nickname", 
                json={"nickname": nickname_a},
                headers={"Authorization": f"Bearer {token_a}"}
            )
            
            if nick_a.status_code == 200:
                self.user_a = {
                    "email": email_a, "password": password_a, "nickname": nickname_a,
                    "session_token": token_a, "user_id": user_a_data["user"]["user_id"]
                }
                print(f"✅ User A registered: {nickname_a}")
        
        # Register User B
        reg_b = requests.post(f"{self.base_url}/auth/register", json={
            "email": email_b, "password": password_b, "confirm_password": password_b
        })
        
        if reg_b.status_code == 200:
            token_b = reg_b.cookies.get("session_token")
            user_b_data = reg_b.json()
            
            # Set nickname for User B
            nick_b = requests.post(f"{self.base_url}/auth/nickname",
                json={"nickname": nickname_b},
                headers={"Authorization": f"Bearer {token_b}"}
            )
            
            if nick_b.status_code == 200:
                self.user_b = {
                    "email": email_b, "password": password_b, "nickname": nickname_b,
                    "session_token": token_b, "user_id": user_b_data["user"]["user_id"]
                }
                print(f"✅ User B registered: {nickname_b}")
        
        return bool(self.user_a and self.user_b)
    
    def make_users_friends(self):
        """Make the two users friends"""
        if not (self.user_a and self.user_b):
            print("❌ Need both users registered first")
            return False
            
        print("Making users friends...")
        
        # User A sends friend request to User B
        req_response = requests.post(f"{self.base_url}/friends/request",
            json={"nickname": self.user_b["nickname"]},
            headers={"Authorization": f"Bearer {self.user_a['session_token']}"}
        )
        
        if req_response.status_code == 200:
            request_data = req_response.json()
            request_id = request_data.get("request", {}).get("request_id")
            print(f"✅ Friend request sent, ID: {request_id}")
            
            # User B accepts the request
            accept_response = requests.post(f"{self.base_url}/friends/request/{request_id}/accept",
                headers={"Authorization": f"Bearer {self.user_b['session_token']}"}
            )
            
            if accept_response.status_code == 200:
                print("✅ Friend request accepted")
                return True
            else:
                print(f"❌ Failed to accept friend request: {accept_response.status_code}")
        else:
            print(f"❌ Failed to send friend request: {req_response.status_code}")
            
        return False
    
    def test_messaging_api(self):
        """Test messaging APIs between friends"""
        if not (self.user_a and self.user_b):
            print("❌ Need both users registered")
            return False
            
        print("Testing messaging APIs...")
        
        # User A sends message to User B
        msg_response = requests.post(f"{self.base_url}/messages/send",
            json={
                "receiver_id": self.user_b["user_id"],
                "message": "Hello from automated test!",
                "message_type": "text"
            },
            headers={"Authorization": f"Bearer {self.user_a['session_token']}"}
        )
        
        if msg_response.status_code == 200:
            print("✅ Message sent successfully")
            
            # User B gets conversations
            convos_response = requests.get(f"{self.base_url}/messages/conversations",
                headers={"Authorization": f"Bearer {self.user_b['session_token']}"}
            )
            
            if convos_response.status_code == 200:
                convos_data = convos_response.json()
                conversations = convos_data.get("conversations", [])
                total_unread = convos_data.get("total_unread", 0)
                print(f"✅ Conversations API working - {len(conversations)} conversations, {total_unread} unread")
                
                if conversations:
                    # User B gets chat history with User A
                    chat_response = requests.get(f"{self.base_url}/messages/history/{self.user_a['user_id']}",
                        headers={"Authorization": f"Bearer {self.user_b['session_token']}"}
                    )
                    
                    if chat_response.status_code == 200:
                        chat_data = chat_response.json()
                        messages = chat_data.get("messages", [])
                        print(f"✅ Chat history API working - {len(messages)} messages")
                        return True
                    else:
                        print(f"❌ Failed to get chat history: {chat_response.status_code}")
            else:
                print(f"❌ Failed to get conversations: {convos_response.status_code}")
        else:
            print(f"❌ Failed to send message: {msg_response.status_code}")
            
        return False

    def run_tests(self):
        """Run all messaging tests"""
        print("🔍 Starting Messages API Integration Tests...")
        print("=" * 50)
        
        # Register users
        if not self.register_test_users():
            print("❌ Failed to register test users")
            return False
            
        # Make them friends
        if not self.make_users_friends():
            print("❌ Failed to make users friends")
            return False
            
        # Test messaging
        if not self.test_messaging_api():
            print("❌ Failed messaging API tests")
            return False
            
        print("✅ All messaging API tests passed!")
        
        # Return user credentials for UI testing
        return {
            "user_a": self.user_a,
            "user_b": self.user_b
        }

if __name__ == "__main__":
    tester = MessagesUITester()
    result = tester.run_tests()
    
    if result:
        # Save user data for UI testing
        with open("/app/test_users.json", "w") as f:
            json.dump(result, f, indent=2)
        print("Test users data saved to /app/test_users.json")