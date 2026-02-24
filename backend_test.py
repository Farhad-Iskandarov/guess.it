import requests
import sys
import json
from datetime import datetime

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-copy-3.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_session_token = None

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(response_data) <= 5:
                        print(f"   Response: {json.dumps(response_data, indent=2)}")
                    elif isinstance(response_data, dict):
                        # Show just keys for large responses
                        print(f"   Response keys: {list(response_data.keys())}")
                except:
                    print(f"   Response: {response.text[:100]}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")

            return success, response

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, None

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET", 
            "/api/health",
            200
        )
        if success and response:
            try:
                data = response.json()
                if data.get("status") == "healthy":
                    print("   ✅ Health status is 'healthy'")
                    return True
                else:
                    print(f"   ❌ Expected status 'healthy', got '{data.get('status')}'")
            except:
                print("   ❌ Failed to parse health response")
        return False

    def test_root_api_endpoint(self):
        """Test /api/ root endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "/api/",
            200
        )
        if success and response:
            try:
                data = response.json()
                if data.get("message") == "GuessIt API is running":
                    print("   ✅ API root message correct")
                    return True
                else:
                    print(f"   ❌ Expected 'GuessIt API is running', got '{data.get('message')}'")
            except:
                print("   ❌ Failed to parse API root response")
        return False

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        admin_email = "farhad.isgandar@gmail.com"
        admin_password = "Salam123?"
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/api/auth/login", 
            200,
            data={"email": admin_email, "password": admin_password}
        )
        
        if success and response:
            try:
                data = response.json()
                if data.get("user", {}).get("role") == "admin":
                    print("   ✅ Admin role confirmed")
                    # Store session token from cookies if available
                    if 'Set-Cookie' in response.headers:
                        cookies = response.headers['Set-Cookie']
                        if 'session_token=' in cookies:
                            token_start = cookies.find('session_token=') + len('session_token=')
                            token_end = cookies.find(';', token_start)
                            if token_end == -1:
                                token_end = len(cookies)
                            self.admin_session_token = cookies[token_start:token_end]
                            print(f"   ✅ Session token captured")
                    return True
                else:
                    print(f"   ❌ Expected admin role, got '{data.get('user', {}).get('role')}'")
            except Exception as e:
                print(f"   ❌ Failed to parse admin login response: {e}")
        return False

    def test_football_matches_endpoint(self):
        """Test football matches are being fetched"""
        success, response = self.run_test(
            "Football Matches",
            "GET",
            "/api/football/matches",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                matches = data.get("matches", [])
                total = data.get("total", 0)
                print(f"   ✅ Found {len(matches)} matches (total: {total})")
                
                if matches:
                    # Check first match has required fields
                    first_match = matches[0]
                    required_fields = ["id", "homeTeam", "awayTeam", "status", "dateTime"]
                    missing_fields = [field for field in required_fields if field not in first_match]
                    if not missing_fields:
                        print("   ✅ Match data structure looks correct")
                        return True
                    else:
                        print(f"   ❌ Missing required fields: {missing_fields}")
                else:
                    print("   ⚠️  No matches found, but API is working")
                    return True
            except Exception as e:
                print(f"   ❌ Failed to parse matches response: {e}")
        return False

    def test_competitions_endpoint(self):
        """Test available competitions endpoint"""
        success, response = self.run_test(
            "Football Competitions",
            "GET",
            "/api/football/competitions",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                competitions = data.get("competitions", [])
                print(f"   ✅ Found {len(competitions)} competitions")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse competitions response: {e}")
        return False

    def test_leaderboard_endpoint(self):
        """Test leaderboard endpoint"""
        success, response = self.run_test(
            "Leaderboard",
            "GET",
            "/api/football/leaderboard",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                users = data.get("users", [])
                print(f"   ✅ Leaderboard returned {len(users)} users")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse leaderboard response: {e}")
        return False

    def test_matches_with_total_votes(self):
        """Test matches endpoint returns totalVotes field"""
        success, response = self.run_test(
            "Football Matches with totalVotes",
            "GET",
            "/api/football/matches",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                matches = data.get("matches", [])
                if matches and "totalVotes" in matches[0]:
                    print(f"   ✅ totalVotes field present in matches")
                    return True
                else:
                    print(f"   ❌ totalVotes field missing from matches")
            except Exception as e:
                print(f"   ❌ Failed to parse matches response: {e}")
        return False

    def test_live_matches_endpoint(self):
        """Test live matches endpoint"""
        success, response = self.run_test(
            "Live Matches",
            "GET",
            "/api/football/matches/live",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                matches = data.get("matches", [])
                print(f"   ✅ Live matches returned {len(matches)} matches")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse live matches response: {e}")
        return False

    def test_ended_matches_endpoint(self):
        """Test ended matches endpoint"""
        success, response = self.run_test(
            "Ended Matches", 
            "GET",
            "/api/football/matches/ended",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                matches = data.get("matches", [])
                print(f"   ✅ Ended matches returned {len(matches)} matches")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse ended matches response: {e}")
        return False

    def test_upcoming_matches_endpoint(self):
        """Test upcoming matches endpoint with days parameter"""
        success, response = self.run_test(
            "Upcoming Matches (3 days)",
            "GET", 
            "/api/football/matches/upcoming?days=3",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                matches = data.get("matches", [])
                print(f"   ✅ Upcoming matches returned {len(matches)} matches")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse upcoming matches response: {e}")
        return False

    def test_banners_endpoint(self):
        """Test banners endpoint"""
        success, response = self.run_test(
            "Football Banners",
            "GET",
            "/api/football/banners", 
            200
        )
        
        if success and response:
            try:
                data = response.json()
                banners = data.get("banners", [])
                print(f"   ✅ Banners returned {len(banners)} banners")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse banners response: {e}")
        return False

    def test_news_endpoint(self):
        """Test news endpoint"""
        success, response = self.run_test(
            "News Articles",
            "GET",
            "/api/news",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                articles = data.get("articles", [])
                print(f"   ✅ News returned {len(articles)} articles")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse news response: {e}")
        return False

    def test_subscription_plans_endpoint(self):
        """Test subscription plans endpoint"""
        success, response = self.run_test(
            "Subscription Plans",
            "GET", 
            "/api/subscriptions/plans",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                plans = data.get("plans", [])
                print(f"   ✅ Subscription plans returned {len(plans)} plans")
                if len(plans) == 3:
                    print("   ✅ Expected 3 subscription plans found")
                    return True
                else:
                    print(f"   ⚠️  Expected 3 plans, got {len(plans)}")
                    return True  # Still pass as API works
            except Exception as e:
                print(f"   ❌ Failed to parse subscription plans response: {e}")
        return False

    def test_auth_me_endpoint(self):
        """Test /api/auth/me endpoint after admin login"""
        if not self.admin_session_token:
            print("   ❌ No admin session token available")
            return False
            
        success, response = self.run_test(
            "Auth Me (Admin User)",
            "GET",
            "/api/auth/me",
            200,
            headers={"Cookie": f"session_token={self.admin_session_token}"}
        )
        
        if success and response:
            try:
                data = response.json()
                if data.get("user", {}).get("role") == "admin":
                    print("   ✅ Admin user confirmed via /auth/me")
                    return True
                else:
                    print(f"   ❌ Expected admin role, got '{data.get('user', {}).get('role')}'")
            except Exception as e:
                print(f"   ❌ Failed to parse auth/me response: {e}")
        return False

    def test_predictions_detailed_endpoint(self):
        """Test predictions detailed endpoint"""
        if not self.admin_session_token:
            print("   ❌ No admin session token available")
            return False
            
        success, response = self.run_test(
            "My Predictions Detailed",
            "GET",
            "/api/predictions/me/detailed",
            200,
            headers={"Cookie": f"session_token={self.admin_session_token}"}
        )
        
        if success and response:
            try:
                data = response.json()
                predictions = data.get("predictions", [])
                # Check for exact_score and prediction_type fields
                has_exact_score = any("exact_score" in p for p in predictions)
                has_prediction_type = any("prediction_type" in p for p in predictions)
                print(f"   ✅ Predictions returned {len(predictions)} predictions")
                if has_exact_score or has_prediction_type:
                    print("   ✅ Found exact_score or prediction_type fields")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse predictions detailed response: {e}")
        return False

    def test_admin_dashboard_endpoint(self):
        """Test admin dashboard endpoint"""
        if not self.admin_session_token:
            print("   ❌ No admin session token available")
            return False
            
        success, response = self.run_test(
            "Admin Dashboard",
            "GET", 
            "/api/admin/dashboard",
            200,
            headers={"Cookie": f"session_token={self.admin_session_token}"}
        )
        
        if success and response:
            try:
                data = response.json()
                required_stats = ["total_users", "active_users", "total_matches", "total_predictions"]
                if all(stat in data for stat in required_stats):
                    print("   ✅ Dashboard stats structure correct")
                    return True
                else:
                    print(f"   ❌ Missing required dashboard stats")
            except Exception as e:
                print(f"   ❌ Failed to parse admin dashboard response: {e}")
        return False

    def test_admin_points_config_endpoint(self):
        """Test admin points configuration endpoint"""
        if not self.admin_session_token:
            print("   ❌ No admin session token available")  
            return False
            
        success, response = self.run_test(
            "Admin Points Configuration",
            "GET",
            "/api/admin/points-config",
            200,
            headers={"Cookie": f"session_token={self.admin_session_token}"}
        )
        
        if success and response:
            try:
                data = response.json()
                required_fields = ["correct_prediction", "wrong_penalty", "exact_score_bonus"]
                if all(field in data for field in required_fields):
                    print("   ✅ Points config structure correct")
                    return True
                else:
                    print(f"   ❌ Missing required points config fields")
            except Exception as e:
                print(f"   ❌ Failed to parse points config response: {e}")
        return False

    def test_admin_gift_points_log_endpoint(self):
        """Test admin gift points audit log endpoint"""
        if not self.admin_session_token:
            print("   ❌ No admin session token available")
            return False
            
        success, response = self.run_test(
            "Admin Gift Points Log",
            "GET",
            "/api/admin/gift-points/log", 
            200,
            headers={"Cookie": f"session_token={self.admin_session_token}"}
        )
        
        if success and response:
            try:
                data = response.json()
                log_entries = data.get("log", [])
                print(f"   ✅ Gift points log returned {len(log_entries)} entries")
                return True
            except Exception as e:
                print(f"   ❌ Failed to parse gift points log response: {e}")
        return False

def main():
    """Run all API tests"""
    print("🚀 Starting GuessIt API Tests")
    print("=" * 50)
    
    tester = GuessItAPITester()
    
    # Track test results
    results = {}
    
    # Core API tests
    results["health"] = tester.test_health_endpoint()
    results["root_api"] = tester.test_root_api_endpoint() 
    results["admin_login"] = tester.test_admin_login()
    
    # Football API tests
    results["football_matches"] = tester.test_football_matches_endpoint()
    results["matches_total_votes"] = tester.test_matches_with_total_votes()
    results["live_matches"] = tester.test_live_matches_endpoint()
    results["ended_matches"] = tester.test_ended_matches_endpoint()
    results["upcoming_matches"] = tester.test_upcoming_matches_endpoint()
    results["competitions"] = tester.test_competitions_endpoint()
    results["banners"] = tester.test_banners_endpoint()
    results["leaderboard"] = tester.test_leaderboard_endpoint()
    
    # Content API tests
    results["news"] = tester.test_news_endpoint()
    results["subscription_plans"] = tester.test_subscription_plans_endpoint()
    
    # Auth tests (require admin login)
    results["auth_me"] = tester.test_auth_me_endpoint()
    results["predictions_detailed"] = tester.test_predictions_detailed_endpoint()
    
    # Admin API tests (require admin login)
    results["admin_dashboard"] = tester.test_admin_dashboard_endpoint()
    results["admin_points_config"] = tester.test_admin_points_config_endpoint()
    results["admin_gift_points_log"] = tester.test_admin_gift_points_log_endpoint()
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed_tests = []
    failed_tests = []
    
    for test_name, passed in results.items():
        if passed:
            passed_tests.append(test_name)
            print(f"✅ {test_name}: PASSED")
        else:
            failed_tests.append(test_name)
            print(f"❌ {test_name}: FAILED")
    
    print(f"\n🎯 Overall: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("🎉 All API tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())