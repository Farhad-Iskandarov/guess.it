import requests
import sys
from datetime import datetime

class FootballAPITester:
    def __init__(self, base_url="https://guessit-duplicate.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.session_cookies = None
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, cookies=None, validate_fn=None):
        """Run a single API test with optional validation function"""
        url = f"{self.base_url}{endpoint}"
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {endpoint}")
        
        try:
            session_params = {'timeout': 15}
            if cookies:
                session_params['cookies'] = cookies
            if data:
                session_params['json'] = data

            if method == 'GET':
                response = self.session.get(url, **session_params)
            elif method == 'POST':
                response = self.session.post(url, **session_params)
            elif method == 'PUT':
                response = self.session.put(url, **session_params)
            elif method == 'DELETE':
                response = self.session.delete(url, **session_params)

            success = response.status_code == expected_status
            
            # Additional validation if provided
            validation_passed = True
            validation_msg = ""
            if success and validate_fn:
                try:
                    validation_passed, validation_msg = validate_fn(response)
                    success = success and validation_passed
                except Exception as e:
                    validation_passed = False
                    validation_msg = f"Validation error: {str(e)}"
                    success = False
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if validation_msg:
                    print(f"   Validation: {validation_msg}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(response_data) <= 5:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, dict) and 'message' in response_data:
                        print(f"   Message: {response_data['message']}")
                    elif isinstance(response_data, dict) and 'total' in response_data:
                        print(f"   Total items: {response_data['total']}")
                except:
                    pass
            else:
                self.failed_tests.append(name)
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if not validation_passed and validation_msg:
                    print(f"   Validation failed: {validation_msg}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response text: {response.text[:200]}")

            return success, response

        except Exception as e:
            self.failed_tests.append(name)
            print(f"❌ Failed - Error: {str(e)}")
            return False, None

    def test_admin_login(self, email, password):
        """Test admin login and store session cookies"""
        print("\n" + "="*50)
        print("ADMIN LOGIN TEST")
        print("="*50)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and response:
            # Store session cookies for subsequent requests
            self.session_cookies = response.cookies
            try:
                response_data = response.json()
                user = response_data.get('user', {})
                print(f"   Logged in as: {user.get('email')} (Role: {user.get('role', 'user')})")
                if user.get('role') != 'admin':
                    print(f"⚠️  WARNING: User role is '{user.get('role')}', expected 'admin'")
                return True
            except:
                pass
        return False

    def test_football_endpoints(self):
        """Test football data endpoints"""
        print("\n" + "="*50)
        print("FOOTBALL DATA TESTS")
        print("="*50)
        
        # Validation functions
        def validate_matches_response(response):
            data = response.json()
            if 'matches' not in data or 'total' not in data:
                return False, "Missing 'matches' or 'total' in response"
            if data['total'] <= 0:
                return False, f"Expected total > 0, got {data['total']}"
            return True, f"Found {data['total']} matches"
        
        def validate_competitions_response(response):
            data = response.json()
            if 'competitions' not in data:
                return False, "Missing 'competitions' in response"
            competitions = data['competitions']
            if len(competitions) < 8:
                return False, f"Expected at least 8 leagues, got {len(competitions)}"
            return True, f"Found {len(competitions)} leagues"
        
        def validate_cl_matches(response):
            data = response.json()
            if data.get('total', 0) < 4:
                return False, f"Expected total >= 4 CL matches, got {data.get('total', 0)}"
            return True, f"Found {data['total']} CL matches"
        
        def validate_ended_matches(response):
            data = response.json()
            matches = data.get('matches', [])
            for match in matches:
                score = match.get('score', {})
                if score.get('home') is None or score.get('away') is None:
                    return False, "Ended matches should have scores"
            return True, f"All {len(matches)} ended matches have scores"
        
        def validate_leaderboard(response):
            data = response.json()
            if 'users' not in data:
                return False, "Missing 'users' in leaderboard response"
            return True, f"Leaderboard has users key"
        
        # Test competitions (expect 8 leagues)
        self.run_test(
            "Football competitions /api/football/competitions returns 8 leagues",
            "GET", 
            "/api/football/competitions",
            200,
            validate_fn=validate_competitions_response
        )
        
        # Test matches (expect total > 0)
        self.run_test(
            "Football matches /api/football/matches returns matches with total > 0",
            "GET",
            "/api/football/matches",
            200,
            validate_fn=validate_matches_response
        )
        
        # Test today's matches (expect CL matches with total >= 4)
        self.run_test(
            "Football matches today /api/football/matches/today returns CL matches with total >= 4",
            "GET",
            "/api/football/matches/today",
            200,
            validate_fn=validate_cl_matches
        )
        
        # Test ended matches (should have scores)
        self.run_test(
            "Football ended matches /api/football/matches/ended returns matches with scores",
            "GET",
            "/api/football/matches/ended",
            200,
            validate_fn=validate_ended_matches
        )
        
        # Test live matches (should return valid JSON)
        self.run_test(
            "Football live matches /api/football/matches/live returns valid JSON",
            "GET",
            "/api/football/matches/live",
            200
        )
        
        # Test leaderboard (returns users key)
        self.run_test(
            "Football leaderboard /api/football/leaderboard returns users key",
            "GET",
            "/api/football/leaderboard",
            200,
            validate_fn=validate_leaderboard
        )
        
        # Test competition filters
        self.run_test(
            "Competition filter /api/football/matches/competition/PL returns Premier League matches",
            "GET",
            "/api/football/matches/competition/PL",
            200,
            validate_fn=validate_matches_response
        )
        
        self.run_test(
            "Competition filter /api/football/matches/competition/CL returns CL matches",
            "GET",
            "/api/football/matches/competition/CL",
            200,
            validate_fn=validate_matches_response
        )
        
        self.run_test(
            "Competition filter /api/football/matches/competition/PD returns La Liga matches",
            "GET",
            "/api/football/matches/competition/PD",
            200,
            validate_fn=validate_matches_response
        )

    def test_admin_api_management(self):
        """Test admin API management endpoints"""
        print("\n" + "="*50)
        print("ADMIN API MANAGEMENT TESTS")
        print("="*50)
        
        if not self.session_cookies:
            print("❌ No admin session - skipping API management tests")
            return
        
        # Validation functions
        def validate_apis_list(response):
            data = response.json()
            if 'apis' not in data:
                return False, "Missing 'apis' in response"
            apis = data['apis']
            football_data_found = any('football-data' in api.get('name', '').lower() or 
                                    'football-data.org' in api.get('base_url', '').lower() 
                                    for api in apis)
            if not football_data_found:
                return False, "Football-Data.org config not found in APIs list"
            return True, "Football-Data.org config found"
        
        def validate_api_key_validation(response, should_be_valid=True):
            data = response.json()
            if 'valid' not in data:
                return False, "Missing 'valid' field in validation response"
            is_valid = data['valid']
            if should_be_valid and not is_valid:
                return False, f"Expected valid:true, got valid:{is_valid}"
            elif not should_be_valid and is_valid:
                return False, f"Expected valid:false, got valid:{is_valid}"
            return True, f"Validation result as expected: valid={is_valid}"
        
        # List APIs (should return Football-Data.org config)
        self.run_test(
            "Admin list APIs GET /api/admin/system/apis returns Football-Data.org config",
            "GET",
            "/api/admin/system/apis",
            200,
            cookies=self.session_cookies,
            validate_fn=validate_apis_list
        )
        
        # Validate valid football-data.org key
        self.run_test(
            "Admin validate key POST /api/admin/system/apis/validate with valid football-data.org key returns valid:true",
            "POST",
            "/api/admin/system/apis/validate",
            200,
            data={
                "api_key": "8767f2a0d2ca4adabdfb9e93d1361de6", 
                "base_url": "https://api.football-data.org/v4"
            },
            cookies=self.session_cookies,
            validate_fn=lambda r: validate_api_key_validation(r, should_be_valid=True)
        )

    def test_admin_match_refresh(self):
        """Test admin match refresh functionality"""
        print("\n" + "="*50)
        print("ADMIN MATCH REFRESH TEST")
        print("="*50)
        
        if not self.session_cookies:
            print("❌ No admin session - skipping match refresh test")
            return
        
        self.run_test(
            "Admin Force Refresh Matches",
            "POST",
            "/api/admin/matches/refresh",
            200,
            cookies=self.session_cookies
        )

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        print("\n" + "="*50)
        print("ADMIN DASHBOARD TEST")
        print("="*50)
        
        if not self.session_cookies:
            print("❌ No admin session - skipping dashboard test")
            return
        
        self.run_test(
            "Admin Dashboard",
            "GET",
            "/api/admin/dashboard",
            200,
            cookies=self.session_cookies
        )

def main():
    print("🚀 Starting Multi-Provider Football API System Tests")
    print(f"🕐 Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🏈 Testing football-data.org integration with admin panel API management")
    
    # Setup
    tester = FootballAPITester()
    
    # Test basic health check
    print("\n" + "="*50)
    print("BASIC HEALTH CHECK")
    print("="*50)
    
    tester.run_test(
        "Backend health check /api/health returns 200",
        "GET",
        "/api/health",
        200
    )
    
    # Test football endpoints first (public endpoints)
    tester.test_football_endpoints()
    
    # Test admin login
    print("\n" + "="*50)
    print("ADMIN AUTHENTICATION TEST")
    print("="*50)
    
    admin_login_success = tester.test_admin_login(
        "farhad.isgandar@gmail.com",
        "Salam123?"
    )
    
    if not admin_login_success:
        print("\n❌ CRITICAL: Admin login failed - cannot continue with admin tests")
    else:
        # Test admin functionality
        tester.test_admin_dashboard()
        tester.test_admin_api_management()
        tester.test_admin_match_refresh()
    
    # Print final results
    print("\n" + "="*60)
    print("FINAL TEST RESULTS")
    print("="*60)
    print(f"✅ Tests passed: {tester.tests_passed}")
    print(f"❌ Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"📊 Success rate: {tester.tests_passed}/{tester.tests_run} ({(tester.tests_passed / tester.tests_run * 100):.1f}%)")
    
    if tester.failed_tests:
        print(f"\n📋 Failed tests:")
        for test_name in tester.failed_tests:
            print(f"   • {test_name}")
    
    print(f"🕐 Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Review above for details")
        return 1

if __name__ == "__main__":
    sys.exit(main())