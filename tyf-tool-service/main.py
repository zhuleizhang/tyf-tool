import os
import uvicorn
import signal
import sys

# 使用绝对路径
MODEL_DIR = os.path.join(os.getcwd(), 'easyocr_models')

# 确保在所有导入前设置环境变量
# os.environ['EASYOCR_DOWNLOAD_DIR'] = os.path.join(os.getcwd(), 'easyocr_models')
# os.environ['EASYOCR_DOWNLOAD_DIR'] = MODEL_DIR
# os.environ['EASYOCR_MODULE_PATH'] = MODEL_DIR
# os.environ['EASYOCR_PATH'] = MODEL_DIR


print(f"当前模型目录: {MODEL_DIR}")

def handle_exit(sig, frame):
    print("正在关闭服务...")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)