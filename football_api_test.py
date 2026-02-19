#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import time

class FootballAPITester:
    def __init__(self, base_url="https://full-clone-1.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, passed, details="", response_data=None):
        """Log test results"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            
        result = {
            "name": name,
            "passed": passed,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if not passed and response_data:
            print(f"    Response: {json.dumps(response_data, indent=2)[:300]}...")
        print()

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Prepare headers
        request_headers = {'Content-Type': 'application/json'}
        if headers:
            request_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=request_headers, timeout=15)
            else:
                self.log_test(name, False, f"Unsupported HTTP method: {method}")
                return False, {}

            # Check status code
            success = response.status_code == expected_status
            
            # Try to parse JSON response
            try:
                response_json = response.json()
            except:
                response_json = {"raw_text": response.text[:200]}

            if success:
                self.log_test(name, True, f"Status: {response.status_code}", response_json)
            else:
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code}", response_json)

            return success, response_json

        except requests.exceptions.Timeout:
            self.log_test(name, False, "Request timed out")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log_test(name, False, "Connection error - backend may be down")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_matches_count_requirement(self):
        """Test that /api/football/matches returns 120+ matches as required"""
        success, response = self.run_test(
            "Football Matches - 120+ Count Requirement",
            "GET",
            "/api/football/matches",
            200
        )
        
        if not success:
            return False

        try:
            matches = response.get('matches', [])
            total = response.get('total', len(matches))
            
            # Check if we have 120+ matches
            if total >= 120:
                self.log_test(
                    "Football Matches - Count Validation", 
                    True, 
                    f"Found {total} matches (≥120 ✓)"
                )
                return True
            else:
                self.log_test(
                    "Football Matches - Count Validation", 
                    False, 
                    f"Only {total} matches found, expected ≥120"
                )
                return False
                
        except Exception as e:
            self.log_test("Football Matches - Count Validation", False, f"Exception parsing response: {str(e)}")
            return False

    def test_finished_matches_with_scores(self):
        """Test that FINISHED matches include final scores"""
        success, response = self.run_test(
            "Football Matches - FINISHED with Scores",
            "GET",
            "/api/football/matches",
            200
        )
        
        if not success:
            return False

        try:
            matches = response.get('matches', [])
            
            # Find FINISHED matches
            finished_matches = [m for m in matches if m.get('status') == 'FINISHED']
            
            if not finished_matches:
                self.log_test(
                    "Football Matches - FINISHED Validation", 
                    False, 
                    "No FINISHED matches found to validate scores"
                )
                return False
            
            # Check if finished matches have scores
            matches_with_scores = 0
            matches_without_scores = 0
            
            for match in finished_matches:
                score = match.get('score', {})
                home_score = score.get('home')
                away_score = score.get('away')
                
                if home_score is not None and away_score is not None:
                    matches_with_scores += 1
                else:
                    matches_without_scores += 1
            
            if matches_with_scores > 0:
                self.log_test(
                    "Football Matches - FINISHED Validation", 
                    True, 
                    f"Found {len(finished_matches)} FINISHED matches, {matches_with_scores} with scores, {matches_without_scores} without scores"
                )
                
                # Show sample finished match with score
                sample_match = next((m for m in finished_matches if m.get('score', {}).get('home') is not None), None)
                if sample_match:
                    home_team = sample_match.get('homeTeam', {}).get('name', 'Unknown')
                    away_team = sample_match.get('awayTeam', {}).get('name', 'Unknown')
                    home_score = sample_match.get('score', {}).get('home')
                    away_score = sample_match.get('score', {}).get('away')
                    print(f"    📊 Sample: {home_team} {home_score}-{away_score} {away_team}")
                
                return True
            else:
                self.log_test(
                    "Football Matches - FINISHED Validation", 
                    False, 
                    f"Found {len(finished_matches)} FINISHED matches but none have scores"
                )
                return False
                
        except Exception as e:
            self.log_test("Football Matches - FINISHED Validation", False, f"Exception parsing response: {str(e)}")
            return False

    def test_yesterday_matches_included(self):
        """Test that yesterday's matches are included in the default date range"""
        success, response = self.run_test(
            "Football Matches - Yesterday Included",
            "GET",
            "/api/football/matches",
            200
        )
        
        if not success:
            return False

        try:
            matches = response.get('matches', [])
            filters = response.get('filters', {})
            date_from = filters.get('date_from')
            date_to = filters.get('date_to')
            
            # Calculate expected date range (yesterday + next 7 days)
            today = datetime.now()
            expected_from = (today - timedelta(days=1)).strftime("%Y-%m-%d")
            expected_to = (today + timedelta(days=7)).strftime("%Y-%m-%d")
            
            # Check if the API is using the expected date range
            date_range_correct = date_from == expected_from and date_to == expected_to
            
            if date_range_correct:
                # Look for matches from yesterday
                yesterday_str = expected_from
                yesterday_matches = []
                
                for match in matches:
                    utc_date = match.get('utcDate', '')
                    if utc_date.startswith(yesterday_str):
                        yesterday_matches.append(match)
                
                self.log_test(
                    "Football Matches - Yesterday Validation", 
                    True, 
                    f"Date range: {date_from} to {date_to}, Found {len(yesterday_matches)} matches from yesterday"
                )
                return True
            else:
                self.log_test(
                    "Football Matches - Yesterday Validation", 
                    False, 
                    f"Date range incorrect. Expected {expected_from} to {expected_to}, got {date_from} to {date_to}"
                )
                return False
                
        except Exception as e:
            self.log_test("Football Matches - Yesterday Validation", False, f"Exception parsing response: {str(e)}")
            return False

    def test_live_matches_still_work(self):
        """Test that live matches endpoint still works correctly"""
        success, response = self.run_test(
            "Football Live Matches - Endpoint Working",
            "GET",
            "/api/football/matches/live",
            200
        )
        
        if not success:
            return False

        try:
            matches = response.get('matches', [])
            total = response.get('total', len(matches))
            
            # Check response structure
            if 'matches' in response and 'total' in response:
                self.log_test(
                    "Football Live Matches - Structure Validation", 
                    True, 
                    f"Found {total} live matches, response structure correct"
                )
                
                # If there are live matches, check their status
                if matches:
                    live_status_correct = all(m.get('status') == 'LIVE' for m in matches)
                    if live_status_correct:
                        print(f"    ✅ All {len(matches)} matches have LIVE status")
                    else:
                        non_live = [m for m in matches if m.get('status') != 'LIVE']
                        print(f"    ⚠️  Found {len(non_live)} matches with non-LIVE status")
                
                return True
            else:
                self.log_test(
                    "Football Live Matches - Structure Validation", 
                    False, 
                    f"Response missing required fields: matches={bool('matches' in response)}, total={bool('total' in response)}"
                )
                return False
                
        except Exception as e:
            self.log_test("Football Live Matches - Structure Validation", False, f"Exception parsing response: {str(e)}")
            return False

    def test_competition_data_integrity(self):
        """Test that match data includes proper competition information"""
        success, response = self.run_test(
            "Football Matches - Competition Data",
            "GET",
            "/api/football/matches",
            200
        )
        
        if not success:
            return False

        try:
            matches = response.get('matches', [])
            
            if not matches:
                self.log_test("Football Matches - Competition Validation", False, "No matches to validate")
                return False
            
            # Check competition data in first few matches
            sample_matches = matches[:5]  # Check first 5 matches
            competitions_found = set()
            
            for match in sample_matches:
                competition = match.get('competition', 'Unknown')
                competition_code = match.get('competitionCode', '')
                
                if competition and competition != 'Unknown':
                    competitions_found.add(f"{competition} ({competition_code})")
            
            if competitions_found:
                self.log_test(
                    "Football Matches - Competition Validation", 
                    True, 
                    f"Found matches from {len(competitions_found)} competitions: {', '.join(list(competitions_found)[:3])}..."
                )
                return True
            else:
                self.log_test(
                    "Football Matches - Competition Validation", 
                    False, 
                    "No valid competition data found in matches"
                )
                return False
                
        except Exception as e:
            self.log_test("Football Matches - Competition Validation", False, f"Exception parsing response: {str(e)}")
            return False

    def test_rate_limit_info(self):
        """Test API rate limit information by checking headers or response"""
        print("🔄 Testing Football API Rate Limit Status...")
        
        # Make a request to check rate limiting
        url = f"{self.base_url}/api/football/matches"
        headers = {'Content-Type': 'application/json'}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            
            # Check for rate limit headers (common patterns)
            rate_headers = {
                'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining'),
                'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
                'X-Rate-Limit-Remaining': response.headers.get('X-Rate-Limit-Remaining'),
                'X-Rate-Limit-Limit': response.headers.get('X-Rate-Limit-Limit'),
            }
            
            # Filter out None values
            found_headers = {k: v for k, v in rate_headers.items() if v is not None}
            
            if found_headers:
                self.log_test(
                    "Football API - Rate Limit Headers", 
                    True, 
                    f"Rate limit info found: {found_headers}"
                )
            else:
                # No headers found, but that's not necessarily a failure
                self.log_test(
                    "Football API - Rate Limit Headers", 
                    True, 
                    "No rate limit headers found (may be handled internally)"
                )
            
            return True, found_headers
            
        except Exception as e:
            self.log_test("Football API - Rate Limit Headers", False, f"Exception: {str(e)}")
            return False, {}

    def run_football_api_tests(self):
        """Run all football API specific tests for the fixes"""
        print("=" * 70)
        print("⚽ Football API Improvements Testing")
        print("Testing fixes: Extended date range + yesterday's matches")
        print("=" * 70)
        print()

        # Test 1: Match count requirement (120+)
        print("🔍 Testing match count requirement...")
        self.test_matches_count_requirement()

        # Test 2: FINISHED matches have scores
        print("🔍 Testing FINISHED matches with scores...")
        self.test_finished_matches_with_scores()

        # Test 3: Yesterday's matches included
        print("🔍 Testing yesterday's matches inclusion...")
        self.test_yesterday_matches_included()

        # Test 4: Live matches still work
        print("🔍 Testing live matches functionality...")
        self.test_live_matches_still_work()

        # Test 5: Competition data integrity
        print("🔍 Testing competition data integrity...")
        self.test_competition_data_integrity()

        # Test 6: Rate limit info
        self.test_rate_limit_info()

        # Print summary
        print("=" * 70)
        print("📊 FOOTBALL API TEST SUMMARY")
        print("=" * 70)
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t["passed"]]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  • {test['name']}: {test['details']}")
        else:
            print(f"\n🎉 All football API improvements working correctly!")
        
        print("=" * 70)
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = FootballAPITester()
    
    try:
        success = tester.run_football_api_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test runner error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())