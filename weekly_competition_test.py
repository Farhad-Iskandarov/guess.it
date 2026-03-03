#!/usr/bin/env python3
"""
Weekly Competition System Test Suite
Tests all weekly competition endpoints and functionality as specified in the testing requirements.
"""

import requests
import sys
import time
import json
from datetime import datetime
from urllib.parse import urljoin

class WeeklyCompetitionTester:
    def __init__(self, base_url="https://project-backup-1.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.admin_cookies = {}
        self.tests_run = 0
        self.tests_passed = 0
        
        print(f"🏆 Testing Weekly Competition System at: {self.base_url}")
        print("=" * 80)

    def run_test(self, name, method, endpoint, expected_status=200, data=None, cookies=None, headers=None):
        """Run a single test with detailed reporting"""
        self.tests_run += 1
        url = f"{self.base_url}/api/{endpoint.lstrip('/')}"
        
        print(f"\n🧪 Test {self.tests_run}: {name}")
        print(f"   {method} {url}")
        
        try:
            req_headers = {'Content-Type': 'application/json'}
            if headers:
                req_headers.update(headers)
                
            if method.upper() == 'GET':
                response = self.session.get(url, headers=req_headers, cookies=cookies, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=req_headers, cookies=cookies, timeout=30)
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"   ✅ PASS - Status: {response.status_code}")
                
                try:
                    result = response.json()
                    return True, result
                except:
                    return True, response.text
            else:
                print(f"   ❌ FAIL - Expected {expected_status}, got {response.status_code}")
                try:
                    error_content = response.json()
                    print(f"   📄 Response: {json.dumps(error_content, indent=2)}")
                except:
                    print(f"   📄 Response: {response.text[:200]}")
                return False, {}
                
        except Exception as e:
            print(f"   💥 ERROR - {str(e)}")
            return False, {}

    def test_health_endpoint(self):
        """Test basic health check"""
        success, response = self.run_test("Health Check", "GET", "health", 200)
        if success and isinstance(response, dict):
            if response.get('status') == 'healthy':
                print(f"   ℹ️  Server is healthy at: {response.get('timestamp')}")
                return True
        return False

    def test_system_metrics(self):
        """Test system metrics endpoint - should return Redis connected, MongoDB connected"""
        success, response = self.run_test("System Metrics", "GET", "system/metrics", 200)
        if success and isinstance(response, dict):
            redis_status = response.get('redis')
            mongodb_status = response.get('mongodb')
            
            print(f"   📊 Redis status: {redis_status}")
            print(f"   📊 MongoDB status: {mongodb_status}")
            
            redis_ok = redis_status == 'connected'
            mongodb_ok = mongodb_status == 'connected'
            
            if redis_ok and mongodb_ok:
                print(f"   ✅ Both Redis and MongoDB are connected")
                return True
            else:
                print(f"   ❌ Database connectivity issues detected")
                return False
        return False

    def test_weekly_status(self):
        """Test GET /api/weekly/status - should return current_season_id (2026-W10), season_status (active), ends_in_seconds (positive int), total_participants (8)"""
        success, response = self.run_test("Weekly Status", "GET", "weekly/status", 200)
        if success and isinstance(response, dict):
            current_season_id = response.get('current_season_id')
            season_status = response.get('season_status')
            ends_in_seconds = response.get('ends_in_seconds')
            total_participants = response.get('total_participants')
            starts_at = response.get('starts_at')
            ends_at = response.get('ends_at')
            
            print(f"   🏆 Season ID: {current_season_id}")
            print(f"   📊 Status: {season_status}")
            print(f"   ⏰ Ends in: {ends_in_seconds} seconds")
            print(f"   👥 Participants: {total_participants}")
            print(f"   📅 Period: {starts_at} to {ends_at}")
            
            # Verify expected values
            checks = [
                (current_season_id == '2026-W10', f"Season ID should be 2026-W10, got {current_season_id}"),
                (season_status == 'active', f"Season status should be active, got {season_status}"),
                (isinstance(ends_in_seconds, int) and ends_in_seconds > 0, f"ends_in_seconds should be positive int, got {ends_in_seconds}"),
                (total_participants == 8, f"Total participants should be 8, got {total_participants}"),
                (starts_at is not None, "starts_at should be present"),
                (ends_at is not None, "ends_at should be present")
            ]
            
            all_passed = True
            for check_result, message in checks:
                status = "✅" if check_result else "❌"
                print(f"   {status} {message}")
                if not check_result:
                    all_passed = False
            
            return all_passed
        return False

    def test_weekly_leaderboard(self):
        """Test GET /api/weekly/leaderboard - should return season_id, users array with CR7_Fan (320 pts) at top"""
        success, response = self.run_test("Weekly Leaderboard", "GET", "weekly/leaderboard", 200)
        if success and isinstance(response, dict):
            season_id = response.get('season_id')
            users = response.get('users', [])
            total_participants = response.get('total_participants')
            week_start = response.get('week_start')
            week_end = response.get('week_end')
            
            print(f"   🏆 Season ID: {season_id}")
            print(f"   👥 Users returned: {len(users)}")
            print(f"   📊 Total participants: {total_participants}")
            print(f"   📅 Week: {week_start} to {week_end}")
            
            # Check if CR7_Fan is at the top
            if users and len(users) > 0:
                top_user = users[0]
                nickname = top_user.get('nickname')
                weekly_points = top_user.get('weekly_points')
                
                print(f"   🥇 Top user: {nickname} with {weekly_points} weekly points")
                
                checks = [
                    (nickname == 'CR7_Fan', f"Top user should be CR7_Fan, got {nickname}"),
                    (weekly_points == 320, f"CR7_Fan should have 320 weekly points, got {weekly_points}"),
                    (total_participants == 8, f"Should show 8 participants, got {total_participants}")
                ]
                
                all_passed = True
                for check_result, message in checks:
                    status = "✅" if check_result else "❌"
                    print(f"   {status} {message}")
                    if not check_result:
                        all_passed = False
                
                return all_passed
            else:
                print(f"   ❌ No users returned in leaderboard")
                return False
        return False

    def test_weekly_summary(self):
        """Test GET /api/weekly/summary/2026-W09 - should return completed season data with winner MessiGoat (410 pts)"""
        success, response = self.run_test("Weekly Summary", "GET", "weekly/summary/2026-W09", 200)
        if success and isinstance(response, dict):
            season_id = response.get('season_id')
            winner = response.get('winner')
            top_10 = response.get('top_10', [])
            total_participants = response.get('total_participants')
            total_predictions = response.get('total_predictions')
            
            print(f"   🏆 Season ID: {season_id}")
            print(f"   👑 Winner: {winner}")
            print(f"   🏅 Top 10 users: {len(top_10)}")
            print(f"   👥 Total participants: {total_participants}")
            print(f"   🎯 Total predictions: {total_predictions}")
            
            checks = [
                (season_id == '2026-W09', f"Season ID should be 2026-W09, got {season_id}"),
                (total_participants == 12, f"Should have 12 participants, got {total_participants}"),
                (total_predictions == 340, f"Should have 340 predictions, got {total_predictions}")
            ]
            
            if winner:
                winner_nickname = winner.get('nickname')
                winner_points = winner.get('points')
                checks.extend([
                    (winner_nickname == 'MessiGoat', f"Winner should be MessiGoat, got {winner_nickname}"),
                    (winner_points == 410, f"Winner should have 410 points, got {winner_points}")
                ])
                print(f"   👑 Winner details: {winner_nickname} with {winner_points} points")
            
            all_passed = True
            for check_result, message in checks:
                status = "✅" if check_result else "❌"
                print(f"   {status} {message}")
                if not check_result:
                    all_passed = False
            
            return all_passed
        return False

    def test_weekly_history(self):
        """Test GET /api/weekly/history - should return seasons array with 2026-W09 and its winner info"""
        success, response = self.run_test("Weekly History", "GET", "weekly/history", 200)
        if success and isinstance(response, dict):
            seasons = response.get('seasons', [])
            
            print(f"   📅 Seasons returned: {len(seasons)}")
            
            # Look for 2026-W09 season
            w09_season = None
            for season in seasons:
                if season.get('season_id') == '2026-W09':
                    w09_season = season
                    break
            
            if w09_season:
                season_id = w09_season.get('season_id')
                winner = w09_season.get('winner')
                
                print(f"   🏆 Found season: {season_id}")
                print(f"   👑 Winner info: {winner}")
                
                checks = [
                    (season_id == '2026-W09', f"Should find season 2026-W09, got {season_id}"),
                    (winner is not None, f"Season should have winner info")
                ]
                
                if winner:
                    winner_nickname = winner.get('nickname')
                    checks.append((winner_nickname == 'MessiGoat', f"Winner should be MessiGoat, got {winner_nickname}"))
                
                all_passed = True
                for check_result, message in checks:
                    status = "✅" if check_result else "❌"
                    print(f"   {status} {message}")
                    if not check_result:
                        all_passed = False
                
                return all_passed
            else:
                print(f"   ❌ Season 2026-W09 not found in history")
                return False
        return False

    def test_football_leaderboard_weekly(self):
        """Test GET /api/football/leaderboard/weekly - should return season-based weekly leaderboard (backward compatibility)"""
        success, response = self.run_test("Football Weekly Leaderboard", "GET", "football/leaderboard/weekly", 200)
        if success and isinstance(response, dict):
            users = response.get('users', [])
            season_id = response.get('season_id')
            
            print(f"   🏆 Season ID: {season_id}")
            print(f"   👥 Users returned: {len(users)}")
            
            # Should be same as weekly leaderboard API
            if users and len(users) > 0:
                top_user = users[0]
                nickname = top_user.get('nickname')
                weekly_points = top_user.get('weekly_points')
                
                print(f"   🥇 Top user: {nickname} with {weekly_points} weekly points")
                
                # Should match the weekly leaderboard results
                checks = [
                    (nickname == 'CR7_Fan', f"Top user should be CR7_Fan, got {nickname}"),
                    (weekly_points == 320, f"CR7_Fan should have 320 weekly points, got {weekly_points}")
                ]
                
                all_passed = True
                for check_result, message in checks:
                    status = "✅" if check_result else "❌"
                    print(f"   {status} {message}")
                    if not check_result:
                        all_passed = False
                
                return all_passed
            else:
                print(f"   ❌ No users returned")
                return False
        return False

    def test_football_leaderboard_global(self):
        """Test GET /api/football/leaderboard - should return global leaderboard with CR7_Fan at top (2450 pts)"""
        success, response = self.run_test("Football Global Leaderboard", "GET", "football/leaderboard", 200)
        if success and isinstance(response, dict):
            users = response.get('users', [])
            
            print(f"   👥 Users returned: {len(users)}")
            
            if users and len(users) > 0:
                top_user = users[0]
                nickname = top_user.get('nickname')
                total_points = top_user.get('points')
                
                print(f"   🥇 Top user: {nickname} with {total_points} total points")
                
                checks = [
                    (nickname == 'CR7_Fan', f"Top user should be CR7_Fan, got {nickname}"),
                    (total_points == 2450, f"CR7_Fan should have 2450 total points, got {total_points}")
                ]
                
                all_passed = True
                for check_result, message in checks:
                    status = "✅" if check_result else "❌"
                    print(f"   {status} {message}")
                    if not check_result:
                        all_passed = False
                
                return all_passed
            else:
                print(f"   ❌ No users returned")
                return False
        return False

    def test_admin_login(self):
        """Test admin login with admin@guessit.com / Admin123!"""
        admin_data = {
            "email": "admin@guessit.com",
            "password": "Admin123!"
        }
        
        success, response = self.run_test("Admin Login", "POST", "auth/login", 200, admin_data)
        if success and isinstance(response, dict):
            if 'session_token' in response:
                self.admin_cookies = {'session_token': response['session_token']}
                print(f"   🔑 Admin logged in successfully")
                return True
            elif response.get('message') == 'Login successful':
                print(f"   🔑 Admin login successful via cookie")
                return True
        return False

    def test_homepage(self):
        """Test homepage loading without errors"""
        try:
            print(f"\n🌐 Testing Frontend Homepage")
            response = self.session.get(self.base_url, timeout=30)
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"   ✅ Homepage loaded successfully")
                
                # Check if it's not an error page
                if 'error' not in response.text.lower() and '500' not in response.text:
                    print(f"   ✅ No errors detected in homepage content")
                    return True
                else:
                    print(f"   ❌ Error detected in homepage content")
                    return False
            else:
                print(f"   ❌ Homepage failed to load: {response.status_code}")
                return False
        except Exception as e:
            print(f"   💥 Homepage error: {e}")
            return False

    def run_all_tests(self):
        """Execute the complete weekly competition test suite"""
        print("🏁 Starting Weekly Competition Test Suite")
        print("=" * 80)
        
        # Core system tests
        print("\n📋 CORE SYSTEM TESTS")
        self.test_health_endpoint()
        self.test_system_metrics()
        
        # Weekly competition API tests
        print("\n🏆 WEEKLY COMPETITION API TESTS")
        self.test_weekly_status()
        self.test_weekly_leaderboard()
        self.test_weekly_summary()
        self.test_weekly_history()
        self.test_football_leaderboard_weekly()
        self.test_football_leaderboard_global()
        
        # Authentication test
        print("\n🔐 AUTHENTICATION TESTS")
        self.test_admin_login()
        
        # Frontend test
        print("\n🌐 FRONTEND TESTS")
        self.test_homepage()
        
        # Final results
        print("\n" + "=" * 80)
        print("📊 WEEKLY COMPETITION TEST RESULTS")
        print("=" * 80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 WEEKLY COMPETITION: EXCELLENT")
            return 0
        elif success_rate >= 80:
            print("✅ WEEKLY COMPETITION: GOOD")
            return 0
        elif success_rate >= 60:
            print("⚠️  WEEKLY COMPETITION: PARTIAL SUCCESS - Minor issues detected")
            return 1
        else:
            print("❌ WEEKLY COMPETITION: SIGNIFICANT ISSUES - Major fixes needed")
            return 2

def main():
    tester = WeeklyCompetitionTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())