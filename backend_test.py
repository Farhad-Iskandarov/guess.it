#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime

class GuessItAPITester:
    def __init__(self, base_url="https://guess-it-duplicate-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, success, details=""):
        """Log test results for tracking"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {details}")

    def test_health_check(self):
        """Test backend health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Timestamp: {data.get('timestamp', 'N/A')}"
            
            self.log_result("Backend Health Check", success, details)
            return success
        except Exception as e:
            self.log_result("Backend Health Check", False, f"Exception: {str(e)}")
            return False

    def login(self, email, password):
        """Login and return success status"""
        try:
            login_data = {
                "email": email,
                "password": password
            }
            
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                # Check if session cookies are set
                cookies = self.session.cookies.get_dict()
                if 'session_token' in cookies:
                    details += f", Session token set"
                else:
                    details += f", No session token found"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Raw error: {response.text[:100]}"
            
            self.log_result(f"Login ({email})", success, details)
            return success
            
        except Exception as e:
            self.log_result(f"Login ({email})", False, f"Exception: {str(e)}")
            return False

    def test_profile_bundle(self):
        """Test GET /api/profile/bundle - the main endpoint that was fixed"""
        try:
            response = self.session.get(f"{self.base_url}/api/profile/bundle", timeout=15)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                predictions = data.get('predictions', {})
                summary = predictions.get('summary', {})
                
                # Check summary structure
                correct = summary.get('correct', 0)
                wrong = summary.get('wrong', 0)
                pending = summary.get('pending', 0)
                points = summary.get('points', 0)
                
                # Calculate accuracy
                total_finished = correct + wrong
                accuracy = (correct / total_finished * 100) if total_finished > 0 else 0
                
                details += f", Correct: {correct}, Wrong: {wrong}, Pending: {pending}, Points: {points}"
                details += f", Accuracy: {accuracy:.1f}%"
                
                # Verify the fix: test user should have 2 wrong predictions 
                if wrong == 2 and correct == 0:
                    details += " ✓ Statistics match expected (0 correct, 2 wrong)"
                elif wrong != 2 or correct != 0:
                    details += f" ⚠ Expected 0 correct, 2 wrong but got {correct} correct, {wrong} wrong"
                
                # Check leaderboard
                leaderboard = data.get('friends_leaderboard', {}).get('leaderboard', [])
                details += f", Friends leaderboard: {len(leaderboard)} entries"
                
                # Check recent activity
                recent_preds = predictions.get('predictions', [])
                details += f", Recent predictions: {len(recent_preds)}"
                
                # Verify recent activity has result indicators
                correct_results = sum(1 for p in recent_preds if p.get('result') == 'correct')
                wrong_results = sum(1 for p in recent_preds if p.get('result') == 'wrong')
                pending_results = sum(1 for p in recent_preds if p.get('result') == 'pending')
                
                details += f", Result indicators: {correct_results}C/{wrong_results}W/{pending_results}P"
                
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Raw error: {response.text[:200]}"
            
            self.log_result("Profile Bundle API", success, details)
            return success, response.json() if success else None
            
        except Exception as e:
            self.log_result("Profile Bundle API", False, f"Exception: {str(e)}")
            return False, None

    def test_my_predictions_performance(self):
        """Test GET /api/predictions/me/detailed - MyPredictions page performance (should be <2s)"""
        try:
            start_time = time.time()
            response = self.session.get(f"{self.base_url}/api/predictions/me/detailed", timeout=15)
            end_time = time.time()
            
            response_time = end_time - start_time
            success = response.status_code == 200 and response_time < 2.0
            
            details = f"Status: {response.status_code}, Response time: {response_time:.2f}s"
            
            if response.status_code == 200:
                data = response.json()
                predictions = data.get('predictions', [])
                summary = data.get('summary', {})
                
                correct = summary.get('correct', 0)
                wrong = summary.get('wrong', 0)
                pending = summary.get('pending', 0)
                
                details += f", Total predictions: {len(predictions)}"
                details += f", Summary - Correct: {correct}, Wrong: {wrong}, Pending: {pending}"
                
                # Check if predictions have proper match data
                predictions_with_matches = sum(1 for p in predictions if p.get('match'))
                details += f", With match data: {predictions_with_matches}/{len(predictions)}"
                
                # Performance check
                if response_time < 2.0:
                    details += " ✓ Performance requirement met (<2s)"
                else:
                    details += f" ⚠ Performance issue: {response_time:.2f}s > 2s"
                    success = False
                
                # Verify result computation
                if wrong == 2 and correct == 0:
                    details += " ✓ MyPredictions summary matches expected"
                else:
                    details += f" ⚠ Summary mismatch with expected values"
                    
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Raw error: {response.text[:200]}"
            
            self.log_result("My Predictions Performance", success, details)
            return success
            
        except Exception as e:
            self.log_result("My Predictions Performance", False, f"Exception: {str(e)}")
            return False

    def test_football_matches_today(self):
        """Test GET /api/football/matches/today - should return matches with utcDate field"""
        try:
            response = self.session.get(f"{self.base_url}/api/football/matches/today", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                matches = data.get('matches', [])
                details += f", Matches today: {len(matches)}"
                
                # Check if matches have utcDate field
                utc_date_count = sum(1 for m in matches if m.get('utcDate'))
                details += f", With utcDate: {utc_date_count}/{len(matches)}"
                
                if matches and utc_date_count == len(matches):
                    details += " ✓ All matches have utcDate field"
                elif matches and utc_date_count < len(matches):
                    details += " ⚠ Some matches missing utcDate field"
                    success = False
                else:
                    details += " (No matches today to verify)"
                    
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Raw error: {response.text[:200]}"
            
            self.log_result("Football Matches Today API", success, details)
            return success
            
        except Exception as e:
            self.log_result("Football Matches Today API", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting GuessIt Backend API Tests")
        print("=" * 50)
        
        # Test 1: Health check
        if not self.test_health_check():
            print("❌ Backend health check failed - stopping tests")
            return False
        
        # Test 2: Login as test user
        if not self.login("test@guessit.com", "Test123!"):
            print("❌ Login failed - cannot proceed with authenticated tests")
            return False
        
        # Test 3: Profile bundle (main fix)
        profile_success, profile_data = self.test_profile_bundle()
        if not profile_success:
            print("❌ Profile bundle test failed")
        
        # Test 4: My predictions detailed (performance test)
        self.test_my_predictions_performance()
        
        # Test 5: Football matches today (utcDate field)
        self.test_football_matches_today()
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests PASSED!")
            return True
        else:
            print("⚠️  Some backend tests FAILED")
            return False

def main():
    """Main test execution"""
    tester = GuessItAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/tmp/backend_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())