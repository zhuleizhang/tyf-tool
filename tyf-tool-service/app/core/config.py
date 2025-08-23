import os
from pydantic_settings import BaseSettings
from typing import List
import sys

# 判断是否是打包后的环境
if getattr(sys, 'frozen', False):
    # 打包环境中的路径 - 使用可执行文件所在目录
    application_path = os.path.dirname(sys.executable)
    # 在可执行文件同级目录创建模型文件夹
    MODEL_DIR = os.path.join(application_path, "easyocr_models")
    print(f"打包环境模型目录: {MODEL_DIR}")
else:
    # 开发环境中的路径
    MODEL_DIR = os.path.abspath(os.path.join(os.getcwd(), "easyocr_models"))
    print(f"开发环境模型目录: {MODEL_DIR}")

# 设置环境变量
os.environ["EASYOCR_DOWNLOAD_DIR"] = MODEL_DIR

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "TYF-OCR-Service"
    
    # OCR设置
    OCR_LANGUAGES: List[str] = ["ch_sim", "en"]
    USE_GPU: bool = True
    
    # 模型目录设置 - 使用上面定义的绝对路径
    MODEL_DIR: str = MODEL_DIR
    
    class Config:
        case_sensitive = True

settings = Settings()