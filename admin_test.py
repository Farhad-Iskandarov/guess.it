#!/usr/bin/env python3
"""
Test admin user achievements and notifications
"""

import requests
import sys
import time
import json

def test_admin_achievements():
    base_url = "https://guess-it-fork-1.preview.emergentagent.com"
    session = requests.Session()
    
    # Login as admin
    admin_data = {
        "email": "admin@guessit.com",
        "password": "Admin123!"
    }
    
    response = session.post(
        f"{base_url}/api/auth/login", 
        json=admin_data,
        headers={'Content-Type': 'application/json'}
    )
    
    if response.status_code != 200:
        print("❌ Admin login failed")
        return
    
    print("✅ Admin logged in successfully")
    
    # Check admin notifications
    notif_response = session.get(
        f"{base_url}/api/notifications",
        headers={'Content-Type': 'application/json'}
    )
    
    if notif_response.status_code == 200:
        data = notif_response.json()
        notifications = data.get('notifications', [])
        unread_count = data.get('unread_count', 0)
        
        print(f"📊 Admin notifications: {len(notifications)} total, {unread_count} unread")
        
        # Look for achievement notifications
        achievement_notifs = [n for n in notifications if n.get('type') == 'achievement_unlocked']
        
        if achievement_notifs:
            print(f"🏆 Found {len(achievement_notifs)} achievement notifications:")
            for i, notif in enumerate(achievement_notifs[:3]):  # Show first 3
                print(f"   {i+1}. {notif.get('message', '')}")
                print(f"      Created: {notif.get('created_at', '')}")
                print(f"      Read: {notif.get('read', False)}")
                data = notif.get('data', {})
                if 'achievement_id' in data:
                    print(f"      Achievement ID: {data['achievement_id']}")
        else:
            print("ℹ️  No achievement notifications found for admin")
        
        # Show other notification types
        other_types = {}
        for notif in notifications:
            ntype = notif.get('type', 'unknown')
            other_types[ntype] = other_types.get(ntype, 0) + 1
        
        print(f"📋 Notification types: {other_types}")
    else:
        print(f"❌ Failed to get notifications: {notif_response.status_code}")
    
    # Check admin achievements
    ach_response = session.get(
        f"{base_url}/api/achievements",
        headers={'Content-Type': 'application/json'}
    )
    
    if ach_response.status_code == 200:
        data = ach_response.json()
        completed_count = data.get('completed_count', 0)
        total_count = data.get('total_count', 0)
        stats = data.get('stats', {})
        
        print(f"🏆 Admin achievements: {completed_count}/{total_count} completed")
        print(f"📊 Admin stats: predictions={stats.get('total_predictions', 0)}, correct={stats.get('correct_predictions', 0)}")
        
        # Show completed achievements
        all_achievements = data.get('all', [])
        completed = [a for a in all_achievements if a.get('completed', False)]
        
        if completed:
            print(f"✅ Completed achievements:")
            for ach in completed:
                print(f"   - {ach.get('title', '')}: {ach.get('description', '')}")
        else:
            print("ℹ️  No completed achievements for admin")
    else:
        print(f"❌ Failed to get achievements: {ach_response.status_code}")

if __name__ == "__main__":
    test_admin_achievements()