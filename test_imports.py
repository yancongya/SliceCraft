#!/usr/bin/env python3
"""Test script to verify all imports work."""
import sys
sys.path.insert(0, '.')

try:
    print("Testing imports...")
    
    # Test FastAPI
    from fastapi import FastAPI
    print("✓ FastAPI")
    
    # Test OpenCV
    import cv2
    print(f"✓ OpenCV {cv2.__version__}")
    
    # Test numpy
    import numpy as np
    print(f"✓ NumPy {np.__version__}")
    
    # Test PIL
    from PIL import Image
    print("✓ Pillow")
    
    # Test rembg
    from rembg import remove
    print("✓ rembg")
    
    # Test our modules
    from backend.app.detectors import canny, flood, alpha
    print("✓ Detectors")
    
    from backend.app.removers import rembg_remover, flood_remover, combined_remover
    print("✓ Removers")
    
    print("\n✅ All imports successful!")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)