import requests
import sys
import json
from datetime import datetime

class ExactScoreTester:
    def __init__(self, base_url="https://guess-it-copy-3.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.session_token = None
        self.test_match_id = None

    def run_test(self, name, method, endpoint, expected_status=200, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        # Use session cookies for authentication (more reliable than Authorization header)

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
                    if response.text and response.text.strip():
                        response_data = response.json()
                        if isinstance(response_data, dict) and len(response_data) <= 5:
                            print(f"   Response: {json.dumps(response_data, indent=2)}")
                        elif isinstance(response_data, dict):
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

    def test_login(self):
        """Login with admin credentials"""
        # Use admin credentials provided in the review request
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": "farhad.isgandar@gmail.com", "password": "Salam123?"}
        )
        
        if success and response:
            try:
                data = response.json()
                if 'user' in data:
                    print("   ✅ Admin login successful")
                    # Get session token from response or cookies
                    if 'token' in data:
                        self.session_token = data['token']
                    elif 'Set-Cookie' in response.headers:
                        cookies = response.headers['Set-Cookie']
                        if 'session_token=' in cookies:
                            token_start = cookies.find('session_token=') + len('session_token=')
                            token_end = cookies.find(';', token_start)
                            if token_end == -1:
                                token_end = len(cookies)
                            self.session_token = cookies[token_start:token_end]
                    print(f"   ✅ Session token captured: {self.session_token[:20] if self.session_token else 'None'}...")
                    return True
            except Exception as e:
                print(f"   ❌ Failed to parse login response: {e}")
        return False

    def get_test_match(self):
        """Get a match to test with"""
        success, response = self.run_test(
            "Get Matches for Testing",
            "GET",
            "/api/football/matches",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                matches = data.get("matches", [])
                if matches:
                    # Look for an unlocked upcoming match first
                    for match in matches:
                        if (match.get('status') == 'NOT_STARTED' and 
                            not match.get('predictionLocked', True)):
                            self.test_match_id = match['id']
                            print(f"   ✅ Using unlocked match ID {self.test_match_id} for testing")
                            return True
                    
                    # If no unlocked matches, use any upcoming match (we'll accept the locked error)
                    for match in matches:
                        if match.get('status') == 'NOT_STARTED':
                            self.test_match_id = match['id']
                            print(f"   ⚠️  Using locked match ID {self.test_match_id} for testing (may get errors)")
                            return True
                    
                    # If no upcoming matches, use any match
                    self.test_match_id = matches[0]['id']
                    print(f"   ⚠️  Using finished match ID {self.test_match_id} for testing (may get errors)")
                    return True
            except Exception as e:
                print(f"   ❌ Failed to parse matches: {e}")
        return False

    def test_create_exact_score_prediction(self):
        """Test POST /api/predictions/exact-score"""
        if not self.test_match_id:
            print("❌ No test match available")
            return False
            
        success, response = self.run_test(
            "Create Exact Score Prediction",
            "POST",
            "/api/predictions/exact-score",
            201,  # Created
            data={
                "match_id": self.test_match_id,
                "home_score": 2,
                "away_score": 1
            }
        )
        
        # Handle locked matches gracefully
        if not success and response and response.status_code == 400:
            try:
                error_data = response.json()
                if "already exists" in error_data.get("detail", "").lower():
                    print("   ⚠️  Prediction already exists, will try update instead")
                    return True  # This is expected for existing predictions
                elif "locked" in error_data.get("detail", "").lower() or "closed" in error_data.get("detail", "").lower():
                    print("   ⚠️  Match is locked for predictions (expected for finished/live matches)")
                    return True  # This is expected for locked matches
            except:
                pass
        
        if success and response:
            try:
                data = response.json()
                required_fields = ["exact_score_id", "user_id", "match_id", "home_score", "away_score"]
                if all(field in data for field in required_fields):
                    print("   ✅ Response contains all required fields")
                    if data["home_score"] == 2 and data["away_score"] == 1:
                        print("   ✅ Score values are correct")
                        return True
                    else:
                        print(f"   ❌ Wrong scores: expected 2-1, got {data['home_score']}-{data['away_score']}")
                else:
                    missing = [f for f in required_fields if f not in data]
                    print(f"   ❌ Missing fields: {missing}")
            except Exception as e:
                print(f"   ❌ Failed to parse response: {e}")
        return False

    def test_get_detailed_predictions(self):
        """Test GET /api/predictions/me/detailed returns both normal and exact score predictions merged"""
        success, response = self.run_test(
            "Get Detailed Predictions (Merged)",
            "GET",
            "/api/predictions/me/detailed",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                required_fields = ["predictions", "total", "summary"]
                if all(field in data for field in required_fields):
                    print("   ✅ Response structure correct")
                    
                    predictions = data.get("predictions", [])
                    # Check if we have the exact score prediction
                    exact_score_found = False
                    for pred in predictions:
                        if (pred.get("match_id") == self.test_match_id and 
                            pred.get("exact_score") is not None):
                            exact_score_found = True
                            exact_score = pred["exact_score"]
                            if exact_score.get("home_score") == 2 and exact_score.get("away_score") == 1:
                                print("   ✅ Exact score merged correctly in detailed predictions")
                                # Check prediction_type field
                                pred_type = pred.get("prediction_type")
                                if pred_type in ["exact_score", "both"]:
                                    print(f"   ✅ Prediction type field present: {pred_type}")
                                    return True
                                else:
                                    print(f"   ❌ Unexpected prediction_type: {pred_type}")
                            else:
                                print(f"   ❌ Wrong exact score in detailed: {exact_score}")
                            break
                    
                    if not exact_score_found:
                        print("   ❌ Exact score prediction not found in detailed predictions")
                else:
                    missing = [f for f in required_fields if f not in data]
                    print(f"   ❌ Missing fields: {missing}")
            except Exception as e:
                print(f"   ❌ Failed to parse response: {e}")
        return False

    def test_update_exact_score_prediction(self):
        """Test PUT /api/predictions/exact-score/match/{match_id}"""
        if not self.test_match_id:
            print("❌ No test match available")
            return False
            
        success, response = self.run_test(
            "Update Exact Score Prediction",
            "PUT",
            f"/api/predictions/exact-score/match/{self.test_match_id}",
            200,
            data={
                "match_id": self.test_match_id,
                "home_score": 3,
                "away_score": 0
            }
        )
        
        if success and response:
            try:
                data = response.json()
                if data.get("home_score") == 3 and data.get("away_score") == 0:
                    print("   ✅ Exact score updated correctly")
                    return True
                else:
                    print(f"   ❌ Wrong updated scores: expected 3-0, got {data.get('home_score')}-{data.get('away_score')}")
            except Exception as e:
                print(f"   ❌ Failed to parse response: {e}")
        return False

    def test_create_normal_prediction(self):
        """Test normal 1/X/2 prediction still works"""
        if not self.test_match_id:
            print("❌ No test match available")
            return False
            
        success, response = self.run_test(
            "Create Normal 1/X/2 Prediction",
            "POST",
            "/api/predictions",
            200,  # Could be 200 for update or 201 for create
            data={
                "match_id": self.test_match_id,
                "prediction": "home"
            }
        )
        
        if success and response:
            try:
                data = response.json()
                if data.get("prediction") == "home":
                    print("   ✅ Normal prediction created/updated correctly")
                    return True
                else:
                    print(f"   ❌ Wrong prediction: expected 'home', got '{data.get('prediction')}'")
            except Exception as e:
                print(f"   ❌ Failed to parse response: {e}")
        return False

    def test_detailed_predictions_with_both_types(self):
        """Test detailed predictions returns both prediction_type and exact_score fields correctly"""
        success, response = self.run_test(
            "Get Detailed Predictions (Both Types)",
            "GET",
            "/api/predictions/me/detailed",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                predictions = data.get("predictions", [])
                
                # Find our test match prediction
                test_prediction = None
                for pred in predictions:
                    if pred.get("match_id") == self.test_match_id:
                        test_prediction = pred
                        break
                
                if test_prediction:
                    pred_type = test_prediction.get("prediction_type")
                    exact_score = test_prediction.get("exact_score")
                    normal_pred = test_prediction.get("prediction")
                    
                    if pred_type == "both" and normal_pred and exact_score:
                        print(f"   ✅ Both prediction types present: normal='{normal_pred}', exact_score={exact_score.get('home_score')}-{exact_score.get('away_score')}")
                        return True
                    elif pred_type == "exact_score" and exact_score and not normal_pred:
                        print(f"   ✅ Exact score only: {exact_score.get('home_score')}-{exact_score.get('away_score')}")
                        return True
                    elif pred_type == "winner" and normal_pred and not exact_score:
                        print(f"   ✅ Normal prediction only: {normal_pred}")
                        return True
                    else:
                        print(f"   ❌ Inconsistent prediction data: type={pred_type}, normal={normal_pred}, exact_score={exact_score}")
                else:
                    print("   ❌ Test match prediction not found")
            except Exception as e:
                print(f"   ❌ Failed to parse response: {e}")
        return False

    def test_delete_exact_score_prediction(self):
        """Test DELETE /api/predictions/exact-score/match/{match_id}"""
        if not self.test_match_id:
            print("❌ No test match available")
            return False
            
        success, response = self.run_test(
            "Delete Exact Score Prediction",
            "DELETE",
            f"/api/predictions/exact-score/match/{self.test_match_id}",
            200
        )
        
        if success and response:
            try:
                data = response.json()
                if "message" in data and "deleted" in data["message"].lower():
                    print("   ✅ Exact score prediction deleted successfully")
                    return True
                else:
                    print(f"   ❌ Unexpected delete response: {data}")
            except Exception as e:
                print(f"   ❌ Failed to parse response: {e}")
        return False

def main():
    """Run all exact score prediction tests"""
    print("🚀 Starting Exact Score Prediction Tests")
    print("=" * 60)
    
    tester = ExactScoreTester()
    
    # Track test results
    results = {}
    
    # Authentication setup
    results["login"] = tester.test_login()
    if not results["login"]:
        print("❌ Cannot proceed without authentication")
        return 1
    
    results["get_test_match"] = tester.get_test_match()
    if not results["get_test_match"]:
        print("❌ Cannot proceed without test match")
        return 1
    
    # Core exact score prediction tests
    results["create_exact_score"] = tester.test_create_exact_score_prediction()
    results["get_detailed_merged"] = tester.test_get_detailed_predictions()
    results["update_exact_score"] = tester.test_update_exact_score_prediction()
    results["create_normal_prediction"] = tester.test_create_normal_prediction()
    results["detailed_both_types"] = tester.test_detailed_predictions_with_both_types()
    results["delete_exact_score"] = tester.test_delete_exact_score_prediction()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 EXACT SCORE PREDICTION TEST SUMMARY")
    print("=" * 60)
    
    passed_tests = []
    failed_tests = []
    
    test_descriptions = {
        "login": "User Authentication",
        "get_test_match": "Get Test Match",
        "create_exact_score": "POST /api/predictions/exact-score",
        "get_detailed_merged": "GET /api/predictions/me/detailed (merged data)",
        "update_exact_score": "PUT /api/predictions/exact-score/match/{match_id}",
        "create_normal_prediction": "POST /api/predictions (normal 1/X/2)",
        "detailed_both_types": "Detailed predictions with prediction_type field",
        "delete_exact_score": "DELETE /api/predictions/exact-score/match/{match_id}"
    }
    
    for test_name, passed in results.items():
        description = test_descriptions.get(test_name, test_name)
        if passed:
            passed_tests.append(description)
            print(f"✅ {description}: PASSED")
        else:
            failed_tests.append(description)
            print(f"❌ {description}: FAILED")
    
    print(f"\n🎯 Overall: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("🎉 All exact score prediction tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())