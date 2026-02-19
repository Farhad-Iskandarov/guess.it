"""
Phase 5 - Performance & UI Polish Backend Tests
Tests for:
- GET /api/football/matches/ended endpoint (recently finished matches)
- Verify ended matches have proper scores and status
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEndedMatchesAPI:
    """Tests for the ended matches endpoint"""
    
    def test_ended_matches_endpoint_exists(self):
        """GET /api/football/matches/ended returns 200"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Ended matches endpoint returns 200")
    
    def test_ended_matches_returns_array(self):
        """Ended matches response contains matches array"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        assert response.status_code == 200
        
        data = response.json()
        assert "matches" in data, "Response missing 'matches' key"
        assert isinstance(data["matches"], list), "matches should be a list"
        print(f"✓ Ended matches returns array with {len(data['matches'])} matches")
    
    def test_ended_matches_have_finished_status(self):
        """All ended matches have FINISHED status"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        data = response.json()
        
        matches = data.get("matches", [])
        if len(matches) == 0:
            pytest.skip("No ended matches available to test")
        
        for match in matches:
            assert match.get("status") == "FINISHED", f"Match {match.get('id')} has status {match.get('status')}"
        
        print(f"✓ All {len(matches)} matches have FINISHED status")
    
    def test_ended_matches_have_scores(self):
        """Ended matches include score data"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        data = response.json()
        
        matches = data.get("matches", [])
        if len(matches) == 0:
            pytest.skip("No ended matches available to test")
        
        for match in matches[:5]:  # Test first 5
            assert "score" in match, f"Match {match.get('id')} missing score"
            score = match["score"]
            assert "home" in score, "Score missing home"
            assert "away" in score, "Score missing away"
            assert isinstance(score["home"], int), "Home score should be integer"
            assert isinstance(score["away"], int), "Away score should be integer"
        
        print(f"✓ Ended matches have proper score data")
    
    def test_ended_matches_have_team_info(self):
        """Ended matches include team information"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        data = response.json()
        
        matches = data.get("matches", [])
        if len(matches) == 0:
            pytest.skip("No ended matches available to test")
        
        match = matches[0]
        
        # Check home team
        assert "homeTeam" in match, "Missing homeTeam"
        assert "id" in match["homeTeam"], "homeTeam missing id"
        assert "name" in match["homeTeam"], "homeTeam missing name"
        
        # Check away team
        assert "awayTeam" in match, "Missing awayTeam"
        assert "id" in match["awayTeam"], "awayTeam missing id"
        assert "name" in match["awayTeam"], "awayTeam missing name"
        
        print(f"✓ Match {match.get('id')}: {match['homeTeam']['name']} vs {match['awayTeam']['name']}")
    
    def test_ended_matches_within_reasonable_window(self):
        """Ended matches are from within a reasonable time window (approx 24-48h)"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        data = response.json()
        
        matches = data.get("matches", [])
        if len(matches) == 0:
            pytest.skip("No ended matches available to test")
        
        now = datetime.utcnow()
        # Allow 48h window to account for date-based filtering (yesterday to today)
        threshold = now - timedelta(hours=48)
        
        for match in matches[:5]:  # Test first 5
            utc_date_str = match.get("utcDate")
            if utc_date_str:
                # Parse ISO format (e.g., "2026-02-18T20:00:00Z")
                match_date = datetime.fromisoformat(utc_date_str.replace('Z', '+00:00')).replace(tzinfo=None)
                assert match_date >= threshold, f"Match {match.get('id')} is too old: {utc_date_str}"
        
        print(f"✓ All tested matches are within reasonable time window")
    
    def test_ended_matches_sorted_by_recent(self):
        """Ended matches are sorted by most recent first"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        data = response.json()
        
        matches = data.get("matches", [])
        if len(matches) < 2:
            pytest.skip("Need at least 2 matches to test sorting")
        
        # Check that dates are in descending order
        prev_date = None
        for match in matches:
            utc_date_str = match.get("utcDate")
            if utc_date_str and prev_date:
                match_date = datetime.fromisoformat(utc_date_str.replace('Z', '+00:00'))
                assert match_date <= prev_date, "Matches should be sorted by most recent first"
            prev_date = datetime.fromisoformat(utc_date_str.replace('Z', '+00:00')) if utc_date_str else prev_date
        
        print(f"✓ Matches are sorted by most recent first")
    
    def test_ended_matches_total_count(self):
        """Response includes total count"""
        response = requests.get(f"{BASE_URL}/api/football/matches/ended")
        data = response.json()
        
        assert "total" in data, "Response missing 'total' count"
        assert data["total"] == len(data.get("matches", [])), "Total doesn't match array length"
        
        print(f"✓ Total count: {data['total']}")


class TestExistingEndpoints:
    """Regression tests for existing endpoints"""
    
    def test_matches_endpoint(self):
        """GET /api/football/matches still works"""
        response = requests.get(f"{BASE_URL}/api/football/matches")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        print(f"✓ /api/football/matches works - {len(data['matches'])} matches")
    
    def test_live_matches_endpoint(self):
        """GET /api/football/matches/live still works"""
        response = requests.get(f"{BASE_URL}/api/football/matches/live")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        print(f"✓ /api/football/matches/live works - {data.get('total', 0)} live matches")
    
    def test_today_matches_endpoint(self):
        """GET /api/football/matches/today still works"""
        response = requests.get(f"{BASE_URL}/api/football/matches/today")
        assert response.status_code == 200
        data = response.json()
        assert "matches" in data
        print(f"✓ /api/football/matches/today works - {len(data['matches'])} matches")
    
    def test_competitions_endpoint(self):
        """GET /api/football/competitions still works"""
        response = requests.get(f"{BASE_URL}/api/football/competitions")
        assert response.status_code == 200
        data = response.json()
        assert "competitions" in data
        print(f"✓ /api/football/competitions works - {len(data['competitions'])} competitions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
