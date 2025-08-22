import uvicorn
import signal
import sys

from app.core.config import settings
from app.main import app  # 直接导入app对象

print(f"模型目录设置: {settings.MODEL_DIR}")
print("settings 配置: ", settings.model_dump())

def handle_exit(sig, frame):
    print("正在关闭服务...")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

if __name__ == "__main__":
    # 直接使用导入的app对象
    uvicorn.run(app, host="0.0.0.0", port=8000)