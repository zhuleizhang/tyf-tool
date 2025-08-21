import os
from pydantic_settings import BaseSettings
from typing import List

# 使用绝对路径
MODEL_DIR = os.path.abspath("/Users/bytedance/Desktop/other/tyf-tool/tyf-tool-service/easyocr_models")

# 设置环境变量 - 在导入其他模块前
# os.environ['EASYOCR_DOWNLOAD_DIR'] = MODEL_DIR

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