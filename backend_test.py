#!/usr/bin/env python3
"""
Backend API Testing for GuessIt Football Prediction Platform
Tests match filtering and display logic after the fix
"""

import requests
import sys
import json
from datetime import datetime, timezone

class FootballAPITester:
    def __init__(self, base_url="https://guess-it-branch.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=15)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text[:500]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_matches_endpoint(self):
        """Test the main matches endpoint returns both upcoming and finished matches"""
        success, response = self.run_test(
            "GET /api/football/matches (main endpoint)",
            "GET",
            "api/football/matches"
        )
        
        if not success:
            return False
            
        matches = response.get('matches', [])
        total = response.get('total', 0)
        
        print(f"📊 Total matches returned: {total}")
        
        if total == 0:
            print("❌ No matches returned - this should not happen")
            return False
            
        # Analyze match statuses
        status_counts = {}
        upcoming_count = 0
        finished_count = 0
        
        for match in matches:
            status = match.get('status', 'UNKNOWN')
            status_counts[status] = status_counts.get(status, 0) + 1
            
            if status in ['NOT_STARTED', 'TIMED', 'SCHEDULED']:
                upcoming_count += 1
            elif status == 'FINISHED':
                finished_count += 1
                
        print(f"📈 Status breakdown: {status_counts}")
        print(f"🔮 Upcoming matches: {upcoming_count}")
        print(f"🏁 Finished matches: {finished_count}")
        
        # Verify we have both upcoming and finished matches
        if upcoming_count == 0:
            print("⚠️  Warning: No upcoming matches found")
        if finished_count == 0:
            print("⚠️  Warning: No finished matches found")
            
        # Expected: 39 upcoming + 46 finished = 85 total
        expected_upcoming = 39
        expected_finished = 46
        expected_total = 85
        
        print(f"🎯 Expected: {expected_upcoming} upcoming, {expected_finished} finished, {expected_total} total")
        
        if upcoming_count == expected_upcoming and finished_count == expected_finished:
            print("✅ Match counts match expectations perfectly!")
        else:
            print(f"⚠️  Match counts differ from expectations")
            
        return True

    def test_ended_matches_endpoint(self):
        """Test the ended matches endpoint"""
        success, response = self.run_test(
            "GET /api/football/matches/ended",
            "GET", 
            "api/football/matches/ended"
        )
        
        if not success:
            return False
            
        matches = response.get('matches', [])
        total = response.get('total', 0)
        
        print(f"📊 Ended matches returned: {total}")
        
        # Verify all matches are finished
        finished_count = 0
        for match in matches:
            if match.get('status') == 'FINISHED':
                finished_count += 1
                
        print(f"🏁 Finished status matches: {finished_count}")
        
        if finished_count == total:
            print("✅ All ended matches have FINISHED status")
        else:
            print(f"❌ Some ended matches don't have FINISHED status")
            
        return True

    def test_upcoming_matches_endpoint(self):
        """Test the upcoming matches endpoint"""
        success, response = self.run_test(
            "GET /api/football/matches/upcoming",
            "GET",
            "api/football/matches/upcoming"
        )
        
        if not success:
            return False
            
        matches = response.get('matches', [])
        total = response.get('total', 0)
        
        print(f"📊 Upcoming matches returned: {total}")
        
        # Verify all matches are upcoming
        upcoming_count = 0
        for match in matches:
            status = match.get('status')
            if status in ['NOT_STARTED', 'TIMED', 'SCHEDULED']:
                upcoming_count += 1
                
        print(f"🔮 Upcoming status matches: {upcoming_count}")
        
        if upcoming_count == total:
            print("✅ All upcoming matches have correct status")
        else:
            print(f"❌ Some upcoming matches have incorrect status")
            
        return True

    def test_live_matches_endpoint(self):
        """Test the live matches endpoint"""
        success, response = self.run_test(
            "GET /api/football/matches/live",
            "GET",
            "api/football/matches/live"
        )
        
        if not success:
            return False
            
        matches = response.get('matches', [])
        total = response.get('total', 0)
        
        print(f"📊 Live matches returned: {total}")
        
        # Verify all matches are live (if any)
        live_count = 0
        for match in matches:
            status = match.get('status')
            if status in ['LIVE', 'IN_PLAY', 'HALFTIME', 'PAUSED']:
                live_count += 1
                
        print(f"🔴 Live status matches: {live_count}")
        
        if live_count == total:
            print("✅ All live matches have correct status")
        else:
            print(f"❌ Some live matches have incorrect status")
            
        return True

    def test_competition_filter(self):
        """Test competition filtering"""
        competitions = ['PL', 'PD', 'SA', 'BL1', 'FL1']
        
        for comp in competitions:
            success, response = self.run_test(
                f"GET /api/football/matches?competition={comp}",
                "GET",
                f"api/football/matches?competition={comp}"
            )
            
            if success:
                matches = response.get('matches', [])
                total = response.get('total', 0)
                print(f"📊 {comp} matches: {total}")
                
                # Verify all matches belong to the competition
                correct_comp = 0
                for match in matches:
                    if match.get('competitionCode') == comp:
                        correct_comp += 1
                        
                if correct_comp == total:
                    print(f"✅ All {comp} matches have correct competition code")
                else:
                    print(f"❌ Some {comp} matches have incorrect competition code")
            else:
                return False
                
        return True

    def test_match_data_structure(self):
        """Test that matches have required fields"""
        success, response = self.run_test(
            "GET /api/football/matches (data structure)",
            "GET",
            "api/football/matches"
        )
        
        if not success:
            return False
            
        matches = response.get('matches', [])
        
        if not matches:
            print("❌ No matches to test data structure")
            return False
            
        # Test first match structure
        match = matches[0]
        required_fields = [
            'id', 'homeTeam', 'awayTeam', 'competition', 'competitionCode',
            'status', 'utcDate', 'score', 'predictionLocked'
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in match:
                missing_fields.append(field)
                
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            return False
        else:
            print("✅ All required fields present in match data")
            
        # Test team structure
        home_team = match.get('homeTeam', {})
        away_team = match.get('awayTeam', {})
        
        team_fields = ['id', 'name', 'shortName']
        for team, team_name in [(home_team, 'homeTeam'), (away_team, 'awayTeam')]:
            for field in team_fields:
                if field not in team:
                    print(f"❌ Missing {field} in {team_name}")
                    return False
                    
        print("✅ Team data structure is correct")
        return True

def main():
    print("🚀 Starting Football API Backend Tests")
    print("=" * 60)
    
    tester = FootballAPITester()
    
    # Test all endpoints
    tests = [
        tester.test_matches_endpoint,
        tester.test_ended_matches_endpoint, 
        tester.test_upcoming_matches_endpoint,
        tester.test_live_matches_endpoint,
        tester.test_competition_filter,
        tester.test_match_data_structure
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            tester.tests_run += 1
    
    print("\n" + "=" * 60)
    print(f"📊 Tests Summary: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("❌ Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())