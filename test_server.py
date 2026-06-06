#!/usr/bin/env python3
"""Test script to start the server and verify it works."""
import sys
import time
import threading
import requests
sys.path.insert(0, '.')

def start_server():
    """Start the server in a separate thread."""
    import uvicorn
    from backend.app.main import app
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="error")

def test_server():
    """Test the server endpoints."""
    time.sleep(2)  # Wait for server to start
    
    try:
        # Test health endpoint
        response = requests.get("http://127.0.0.1:8001/api/health")
        if response.status_code == 200:
            print("✓ Health endpoint working")
            print(f"  Response: {response.json()}")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
        
        # Test root endpoint (should return 404 or something)
        try:
            response = requests.get("http://127.0.0.1:8001/")
            print(f"✓ Root endpoint accessible (status: {response.status_code})")
        except:
            print("⚠ Root endpoint not accessible (expected)")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server")
        return False
    except Exception as e:
        print(f"❌ Error testing server: {e}")
        return False

if __name__ == "__main__":
    print("Starting server test...")
    
    # Start server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Test the server
    success = test_server()
    
    if success:
        print("\n✅ Server test passed!")
    else:
        print("\n❌ Server test failed!")
        sys.exit(1)