#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class EditPredictionTester:
    def __init__(self, base_url="https://guess-it-duplicate.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.headers = {'Content-Type': 'application/json'}
        self.tests_run = 0
        self.tests_passed = 0
        
    def log_test(self, name, passed, details=""):
        """Log test results"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        print()

    def login_test_user(self):
        """Login with test credentials edittest@test.com"""
        print("🔐 Logging in with test credentials...")
        
        response = self.session.post(f"{self.base_url}/api/auth/login", json={
            "email": "edittest@test.com",
            "password": "Test123!"
        }, headers=self.headers, timeout=10)
        
        if response.status_code == 200:
            self.log_test("Login Test User", True, "Successfully logged in")
            return True
        else:
            self.log_test("Login Test User", False, f"Status: {response.status_code}, Response: {response.text}")
            return False

    def get_user_predictions(self):
        """Get user's existing predictions"""
        print("📋 Fetching user predictions...")
        
        response = self.session.get(f"{self.base_url}/api/predictions/me/detailed", 
                                    headers=self.headers, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            predictions = data.get('predictions', [])
            upcoming_predictions = [p for p in predictions if p.get('match', {}).get('status') == 'NOT_STARTED']
            
            self.log_test("Get User Predictions", True, 
                         f"Found {len(predictions)} total, {len(upcoming_predictions)} upcoming predictions")
            return upcoming_predictions
        else:
            self.log_test("Get User Predictions", False, f"Status: {response.status_code}")
            return []

    def test_update_prediction(self, match_id, old_prediction, new_prediction):
        """Test updating an existing prediction via POST /api/predictions"""
        print(f"🔄 Testing prediction update: {old_prediction} → {new_prediction} for match {match_id}")
        
        response = self.session.post(f"{self.base_url}/api/predictions", json={
            "match_id": match_id,
            "prediction": new_prediction
        }, headers=self.headers, timeout=10)
        
        if response.status_code in [200, 201]:
            data = response.json()
            if data.get('prediction') == new_prediction and not data.get('is_new', True):
                self.log_test("Update Prediction API", True, 
                             f"Successfully updated to {new_prediction}, is_new: {data.get('is_new')}")
                return True
            else:
                self.log_test("Update Prediction API", False, 
                             f"Wrong prediction returned or is_new flag: {data}")
                return False
        else:
            self.log_test("Update Prediction API", False, f"Status: {response.status_code}")
            return False

    def test_delete_prediction(self, match_id):
        """Test deleting a prediction via DELETE /api/predictions/match/{match_id}"""
        print(f"🗑️ Testing prediction deletion for match {match_id}")
        
        response = self.session.delete(f"{self.base_url}/api/predictions/match/{match_id}", 
                                       headers=self.headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if 'message' in data:
                self.log_test("Delete Prediction API", True, 
                             f"Successfully deleted: {data.get('message')}")
                return True
            else:
                self.log_test("Delete Prediction API", False, f"No success message: {data}")
                return False
        else:
            self.log_test("Delete Prediction API", False, f"Status: {response.status_code}")
            return False

    def verify_prediction_deleted(self, match_id):
        """Verify prediction no longer exists"""
        print(f"✅ Verifying prediction {match_id} was deleted...")
        
        response = self.session.get(f"{self.base_url}/api/predictions/match/{match_id}", 
                                    headers=self.headers, timeout=10)
        
        if response.status_code == 404:
            self.log_test("Verify Deletion", True, "Prediction not found (correctly deleted)")
            return True
        else:
            self.log_test("Verify Deletion", False, f"Prediction still exists: {response.status_code}")
            return False

    def test_full_edit_workflow(self):
        """Test the complete edit workflow"""
        print("🧪 Testing Full Edit/Remove Workflow")
        print("=" * 50)
        
        # Login
        if not self.login_test_user():
            return False
        
        # Get user's predictions
        predictions = self.get_user_predictions()
        if not predictions:
            print("⚠️  No upcoming predictions found for testing")
            return False
        
        # Find predictions to test
        home_predictions = [p for p in predictions if p['prediction'] == 'home']
        if len(home_predictions) < 2:
            print("⚠️  Need at least 2 'home' predictions for testing")
            return False
        
        # Test 1: Update prediction
        test_pred_1 = home_predictions[0]
        match_id_1 = test_pred_1['match_id']
        original_prediction = test_pred_1['prediction']
        
        print(f"\n📝 Test 1: Edit Prediction")
        print(f"Match ID: {match_id_1}")
        print(f"Original: {original_prediction} → New: away")
        
        if not self.test_update_prediction(match_id_1, original_prediction, 'away'):
            return False
        
        # Verify the update worked
        updated_predictions = self.get_user_predictions()
        updated_pred = next((p for p in updated_predictions if p['match_id'] == match_id_1), None)
        
        if updated_pred and updated_pred['prediction'] == 'away':
            self.log_test("Verify Update", True, "Prediction correctly updated to 'away'")
        else:
            self.log_test("Verify Update", False, f"Update not reflected: {updated_pred}")
            return False
        
        # Test 2: Delete prediction
        test_pred_2 = home_predictions[1]
        match_id_2 = test_pred_2['match_id']
        
        print(f"\n🗑️ Test 2: Delete Prediction")
        print(f"Match ID: {match_id_2}")
        
        if not self.test_delete_prediction(match_id_2):
            return False
        
        # Verify deletion
        if not self.verify_prediction_deleted(match_id_2):
            return False
        
        print(f"\n🎉 All edit/remove tests passed!")
        return True

def main():
    """Main test runner"""
    tester = EditPredictionTester()
    
    try:
        success = tester.test_full_edit_workflow()
        
        print("\n" + "=" * 50)
        print("📊 EDIT/REMOVE TEST SUMMARY")
        print("=" * 50)
        print(f"✅ Tests Passed: {tester.tests_passed}/{tester.tests_run}")
        print(f"❌ Tests Failed: {tester.tests_run - tester.tests_passed}/{tester.tests_run}")
        success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test runner error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())