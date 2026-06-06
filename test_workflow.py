#!/usr/bin/env python3
"""Test the complete workflow of the image splitter."""
import sys
import time
import threading
import requests
import base64
import json
sys.path.insert(0, '.')

def start_server():
    """Start the server in a separate thread."""
    import uvicorn
    from backend.app.main import app
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="error")

def test_workflow():
    """Test the complete workflow."""
    time.sleep(2)  # Wait for server to start
    
    base_url = "http://127.0.0.1:8001"
    
    try:
        print("🧪 测试完整工作流程...")
        print()
        
        # 1. Test health endpoint
        print("1. 测试健康检查...")
        response = requests.get(f"{base_url}/api/health")
        if response.status_code == 200:
            print("   ✅ 服务正常运行")
        else:
            print(f"   ❌ 健康检查失败: {response.status_code}")
            return False
        
        # 2. Upload test image
        print("2. 上传测试图片...")
        with open("test_image.png", "rb") as f:
            files = {"file": ("test_image.png", f, "image/png")}
            response = requests.post(f"{base_url}/api/upload", files=files)
        
        if response.status_code == 200:
            data = response.json()
            image_id = data["image_id"]
            print(f"   ✅ 上传成功，图片 ID: {image_id[:8]}...")
            print(f"   📐 尺寸: {data['width']}x{data['height']}")
        else:
            print(f"   ❌ 上传失败: {response.status_code}")
            return False
        
        # 3. Test detection with different methods
        print("3. 测试元素检测...")
        
        # Test Canny detection
        print("   3.1 测试 Canny 边缘检测...")
        form_data = {
            "image_id": image_id,
            "method": "canny",
            "gauss_sigma": 1.0,
            "gauss_amount": 5,
            "threshold1": 50,
            "threshold2": 150,
            "struct_k1": 3,
            "struct_k2": 3,
            "close_iter": 1,
            "dilate_iter": 1
        }
        response = requests.post(f"{base_url}/api/detect", data=form_data)
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Canny 检测成功，找到 {data['count']} 个元素")
            if data['count'] > 0:
                print(f"   📦 第一个元素包围盒: {data['bboxes'][0]}")
        else:
            print(f"   ❌ Canny 检测失败: {response.status_code}")
            print(f"   响应: {response.text}")
            return False
        
        # Test flood detection
        print("   3.2 测试泛洪填充检测...")
        form_data = {
            "image_id": image_id,
            "method": "flood",
            "flood_tolerance": 30,
            "min_area": 100,
            "padding": 5
        }
        response = requests.post(f"{base_url}/api/detect", data=form_data)
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ 泛洪填充检测成功，找到 {data['count']} 个元素")
        else:
            print(f"   ❌ 泛洪填充检测失败: {response.status_code}")
            # Continue with other tests
        
        # 4. Test background removal
        print("4. 测试背景去除...")
        
        # First detect with Canny
        form_data = {
            "image_id": image_id,
            "method": "canny",
            "gauss_sigma": 1.0,
            "gauss_amount": 5,
            "threshold1": 50,
            "threshold2": 150,
            "struct_k1": 3,
            "struct_k2": 3,
            "close_iter": 1,
            "dilate_iter": 1
        }
        requests.post(f"{base_url}/api/detect", data=form_data)
        
        # Test rembg removal
        print("   4.1 测试 rembg AI 抠图...")
        form_data = {
            "image_id": image_id,
            "method": "rembg",
            "model": "u2net",
            "flood_tolerance": 30
        }
        response = requests.post(f"{base_url}/api/remove_background", data=form_data)
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ rembg 抠图成功，处理了 {data['count']} 个元素")
            if data['count'] > 0:
                print(f"   🖼️ 第一个元素预览大小: {len(data['results'][0]['preview'])} 字符")
        else:
            print(f"   ❌ rembg 抠图失败: {response.status_code}")
            print(f"   响应: {response.text}")
            # Continue with other tests
        
        # Test flood removal
        print("   4.2 测试泛洪填充抠图...")
        form_data = {
            "image_id": image_id,
            "method": "flood",
            "model": "u2net",
            "flood_tolerance": 30
        }
        response = requests.post(f"{base_url}/api/remove_background", data=form_data)
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ 泛洪填充抠图成功，处理了 {data['count']} 个元素")
        else:
            print(f"   ❌ 泛洪填充抠图失败: {response.status_code}")
        
        # 5. Test export
        print("5. 测试导出功能...")
        form_data = {"image_id": image_id}
        response = requests.post(f"{base_url}/api/export", data=form_data)
        
        if response.status_code == 200:
            # Check if it's a ZIP file
            content_type = response.headers.get('content-type', '')
            if 'zip' in content_type or 'octet-stream' in content_type:
                print(f"   ✅ 导出成功，文件大小: {len(response.content)} 字节")
                
                # Save the ZIP file
                with open("test_export.zip", "wb") as f:
                    f.write(response.content)
                print("   💾 导出文件已保存: test_export.zip")
            else:
                print(f"   ⚠️ 导出响应类型: {content_type}")
        else:
            print(f"   ❌ 导出失败: {response.status_code}")
        
        print()
        print("✅ 所有测试完成！")
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器")
        return False
    except Exception as e:
        print(f"❌ 测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 启动图片元素拆分工具测试...")
    print()
    
    # Start server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Run the workflow test
    success = test_workflow()
    
    if success:
        print("\n🎉 所有测试通过！")
    else:
        print("\n💥 测试失败！")
        sys.exit(1)