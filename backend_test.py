#!/usr/bin/env python3
"""
Backend API Testing for GuessIt Football Prediction App
Tests all required endpoints as specified in the review request.
Focuses on search functionality and WebSocket connections.
"""

import requests
import sys
import json
import websocket
import threading
import time
from datetime import datetime
from typing import Dict, Any

class GuessItAPITester:
    def __init__(self, base_url: str = "https://guessit-staging-1.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: Dict[str, Any] = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details and not success:
            print(f"    Details: {details}")

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                has_status = "status" in data and data["status"] == "healthy"
                has_timestamp = "timestamp" in data
                
                if has_status and has_timestamp:
                    self.log_test("Health Check Endpoint", True, {
                        "status_code": response.status_code,
                        "response": data
                    })
                    return True
                else:
                    self.log_test("Health Check Endpoint", False, {
                        "status_code": response.status_code,
                        "issue": "Missing required fields in response",
                        "response": data
                    })
                    return False
            else:
                self.log_test("Health Check Endpoint", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Health Check Endpoint", False, {
                "error": str(e)
            })
            return False

    def test_root_api_endpoint(self):
        """Test /api/ root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_message = "GuessIt API is running"
                
                if data.get("message") == expected_message:
                    self.log_test("Root API Endpoint", True, {
                        "status_code": response.status_code,
                        "response": data
                    })
                    return True
                else:
                    self.log_test("Root API Endpoint", False, {
                        "status_code": response.status_code,
                        "issue": f"Expected message '{expected_message}', got '{data.get('message')}'",
                        "response": data
                    })
                    return False
            else:
                self.log_test("Root API Endpoint", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Root API Endpoint", False, {
                "error": str(e)
            })
            return False

    def test_system_metrics_endpoint(self):
        """Test /api/system/metrics endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/system/metrics", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["status", "timestamp", "redis", "mongodb"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    mongodb_connected = data.get("mongodb") == "connected"
                    redis_connected = data.get("redis") == "connected"
                    
                    self.log_test("System Metrics Endpoint", True, {
                        "status_code": response.status_code,
                        "mongodb_status": data.get("mongodb"),
                        "redis_status": data.get("redis"),
                        "websocket_connections": data.get("websocket_connections", {}),
                        "architecture": data.get("architecture", {})
                    })
                    return True
                else:
                    self.log_test("System Metrics Endpoint", False, {
                        "status_code": response.status_code,
                        "issue": f"Missing required fields: {missing_fields}",
                        "response": data
                    })
                    return False
            else:
                self.log_test("System Metrics Endpoint", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("System Metrics Endpoint", False, {
                "error": str(e)
            })
            return False

    def test_football_matches_endpoint(self):
        """Test /api/football/matches endpoint - required for banner carousel testing"""
        try:
            response = requests.get(f"{self.base_url}/api/football/matches", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, dict) and "matches" in data:
                    matches = data["matches"]
                    
                    if isinstance(matches, list):
                        # Check match structure
                        sample_matches = []
                        for match in matches[:3]:
                            sample_matches.append({
                                "id": match.get("id"),
                                "home_team": match.get("homeTeam", {}).get("name"),
                                "away_team": match.get("awayTeam", {}).get("name"),
                                "competition": match.get("competition"),
                                "status": match.get("status"),
                                "utcDate": match.get("utcDate")
                            })
                        
                        self.log_test("Football Matches Endpoint", True, {
                            "status_code": response.status_code,
                            "total_matches": len(matches),
                            "sample_matches": sample_matches
                        })
                        return True
                    else:
                        self.log_test("Football Matches Endpoint", False, {
                            "status_code": response.status_code,
                            "issue": "matches field is not an array",
                            "response": data
                        })
                        return False
                else:
                    self.log_test("Football Matches Endpoint", False, {
                        "status_code": response.status_code,
                        "issue": "Response missing matches field",
                        "response": data
                    })
                    return False
            else:
                self.log_test("Football Matches Endpoint", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Football Matches Endpoint", False, {
                "error": str(e)
            })
            return False

    def test_search_api_champions_query(self):
        """Test search API with 'champions' query - should return Champions League matches"""
        try:
            response = requests.get(f"{self.base_url}/api/football/search?q=champions", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, dict) and "matches" in data:
                    matches = data["matches"]
                    
                    # Check if any matches are from Champions League
                    champions_matches = []
                    for match in matches:
                        competition = match.get("competition", "").lower()
                        if "champions" in competition:
                            champions_matches.append({
                                "id": match.get("id"),
                                "home_team": match.get("homeTeam", {}).get("name"),
                                "away_team": match.get("awayTeam", {}).get("name"),
                                "competition": match.get("competition")
                            })
                    
                    self.log_test("Search API - Champions Query", True, {
                        "status_code": response.status_code,
                        "total_matches": len(matches),
                        "champions_matches_found": len(champions_matches),
                        "sample_champions_matches": champions_matches[:3]
                    })
                    return True
                else:
                    self.log_test("Search API - Champions Query", False, {
                        "status_code": response.status_code,
                        "issue": "Response missing matches field",
                        "response": data
                    })
                    return False
            else:
                self.log_test("Search API - Champions Query", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Search API - Champions Query", False, {
                "error": str(e)
            })
            return False

    def test_search_api_barcelona_query(self):
        """Test search API with 'barcelona' query - should return Barcelona matches"""
        try:
            response = requests.get(f"{self.base_url}/api/football/search?q=barcelona", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, dict) and "matches" in data:
                    matches = data["matches"]
                    
                    # Check if any matches contain Barcelona
                    barcelona_matches = []
                    for match in matches:
                        home_name = match.get("homeTeam", {}).get("name", "").lower()
                        away_name = match.get("awayTeam", {}).get("name", "").lower()
                        if "barcelona" in home_name or "barcelona" in away_name:
                            barcelona_matches.append({
                                "id": match.get("id"),
                                "home_team": match.get("homeTeam", {}).get("name"),
                                "away_team": match.get("awayTeam", {}).get("name"),
                                "competition": match.get("competition")
                            })
                    
                    self.log_test("Search API - Barcelona Query", True, {
                        "status_code": response.status_code,
                        "total_matches": len(matches),
                        "barcelona_matches_found": len(barcelona_matches),
                        "sample_barcelona_matches": barcelona_matches[:3]
                    })
                    return True
                else:
                    self.log_test("Search API - Barcelona Query", False, {
                        "status_code": response.status_code,
                        "issue": "Response missing matches field",
                        "response": data
                    })
                    return False
            else:
                self.log_test("Search API - Barcelona Query", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Search API - Barcelona Query", False, {
                "error": str(e)
            })
            return False

    def test_search_api_case_insensitive(self):
        """Test search API case insensitivity - SERIE should return Serie A matches"""
        try:
            response = requests.get(f"{self.base_url}/api/football/search?q=SERIE", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, dict) and "matches" in data:
                    matches = data["matches"]
                    
                    # Check if any matches are from Serie A
                    serie_matches = []
                    for match in matches:
                        competition = match.get("competition", "").lower()
                        if "serie" in competition:
                            serie_matches.append({
                                "id": match.get("id"),
                                "home_team": match.get("homeTeam", {}).get("name"),
                                "away_team": match.get("awayTeam", {}).get("name"),
                                "competition": match.get("competition")
                            })
                    
                    self.log_test("Search API - Case Insensitive", True, {
                        "status_code": response.status_code,
                        "total_matches": len(matches),
                        "serie_matches_found": len(serie_matches),
                        "sample_serie_matches": serie_matches[:3]
                    })
                    return True
                else:
                    self.log_test("Search API - Case Insensitive", False, {
                        "status_code": response.status_code,
                        "issue": "Response missing matches field",
                        "response": data
                    })
                    return False
            else:
                self.log_test("Search API - Case Insensitive", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Search API - Case Insensitive", False, {
                "error": str(e)
            })
            return False

    def test_search_api_short_query_rejection(self):
        """Test search API rejects short queries (less than 2 characters)"""
        try:
            response = requests.get(f"{self.base_url}/api/football/search?q=x", timeout=15)
            
            # Should return 422 for validation error or 200 with empty results
            if response.status_code == 422:
                self.log_test("Search API - Short Query Rejection", True, {
                    "status_code": response.status_code,
                    "note": "Correctly rejected short query with 422 status"
                })
                return True
            elif response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "matches" in data:
                    matches = data["matches"]
                    if len(matches) == 0:
                        self.log_test("Search API - Short Query Rejection", True, {
                            "status_code": response.status_code,
                            "matches_count": 0,
                            "note": "Correctly returned empty results for short query"
                        })
                        return True
                    else:
                        self.log_test("Search API - Short Query Rejection", False, {
                            "status_code": response.status_code,
                            "issue": "Short query should return empty results",
                            "matches_count": len(matches)
                        })
                        return False
                else:
                    self.log_test("Search API - Short Query Rejection", False, {
                        "status_code": response.status_code,
                        "issue": "Unexpected response format",
                        "response": data
                    })
                    return False
            else:
                self.log_test("Search API - Short Query Rejection", False, {
                    "status_code": response.status_code,
                    "response_text": response.text[:200]
                })
                return False
                
        except Exception as e:
            self.log_test("Search API - Short Query Rejection", False, {
                "error": str(e)
            })
            return False

    def test_websocket_connection(self):
        """Test WebSocket endpoint /api/ws/matches accepts connections"""
        try:
            # Convert HTTP URL to WebSocket URL
            ws_url = self.base_url.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws/matches'
            
            connection_successful = False
            received_messages = []
            connection_error = None
            
            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    received_messages.append(data)
                except:
                    received_messages.append(message)
            
            def on_error(ws, error):
                nonlocal connection_error
                connection_error = str(error)
            
            def on_open(ws):
                nonlocal connection_successful
                connection_successful = True
                # Send a ping to test communication
                ws.send('ping')
                # Close after a short time
                threading.Timer(2.0, lambda: ws.close()).start()
            
            def on_close(ws, close_status_code, close_msg):
                pass
            
            # Create WebSocket connection with timeout
            ws = websocket.WebSocketApp(ws_url,
                                      on_open=on_open,
                                      on_message=on_message,
                                      on_error=on_error,
                                      on_close=on_close)
            
            # Run WebSocket in a separate thread with timeout
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection or timeout
            timeout = 10
            start_time = time.time()
            while time.time() - start_time < timeout:
                if connection_successful or connection_error:
                    break
                time.sleep(0.1)
            
            ws.close()
            
            if connection_successful:
                self.log_test("WebSocket Connection", True, {
                    "ws_url": ws_url,
                    "connection_established": True,
                    "messages_received": len(received_messages),
                    "sample_messages": received_messages[:3] if received_messages else []
                })
                return True
            else:
                self.log_test("WebSocket Connection", False, {
                    "ws_url": ws_url,
                    "connection_established": False,
                    "error": connection_error or "Connection timeout"
                })
                return False
                
        except Exception as e:
            self.log_test("WebSocket Connection", False, {
                "error": str(e)
            })
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting GuessIt Backend API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test basic endpoints first
        self.test_health_endpoint()
        self.test_root_api_endpoint()
        self.test_system_metrics_endpoint()
        
        # Test football matches endpoint (required for banner carousel)
        print("\n⚽ Testing Football API:")
        self.test_football_matches_endpoint()
        
        # Test search functionality (main focus)
        print("\n🔍 Testing Search Functionality:")
        self.test_search_api_champions_query()
        self.test_search_api_barcelona_query()
        self.test_search_api_case_insensitive()
        self.test_search_api_short_query_rejection()
        
        # Test WebSocket connection
        print("\n🌐 Testing WebSocket Connection:")
        self.test_websocket_connection()
        
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print("⚠️  Some backend tests failed!")
            return False

    def get_summary(self):
        """Get test summary"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results
        }

def main():
    """Main test execution"""
    tester = GuessItAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    summary = tester.get_summary()
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())