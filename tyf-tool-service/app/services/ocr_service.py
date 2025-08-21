import easyocr
import numpy as np
from PIL import Image
import io
import base64
import os
import time
from app.core.config import settings

# 添加Pillow 10.0.0兼容性补丁
try:
    # 检查Pillow是否大于等于10.0.0
    from PIL import __version__ as PIL_version
    major_version = int(PIL_version.split('.')[0])
    if major_version >= 10:
        # 添加缺失的常量作为替代品
        Image.ANTIALIAS = Image.LANCZOS
        Image.BICUBIC = Image.BICUBIC
        Image.BILINEAR = Image.BILINEAR
except:
    pass

# 调试信息
print(f"当前工作目录: {os.getcwd()}")
print(f"模型目录设置: {settings.MODEL_DIR}")
print(f"环境变量EASYOCR_DOWNLOAD_DIR: {os.environ.get('EASYOCR_DOWNLOAD_DIR')}")
print(f"模型目录内容: {os.listdir(settings.MODEL_DIR) if os.path.exists(settings.MODEL_DIR) else '目录不存在'}")

# 注意：环境变量已在config.py中设置，这里移除重复设置
# os.environ['EASYOCR_MODULE_PATH'] = settings.MODEL_DIR

class OCRService:
    _instance = None
    _reader = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OCRService, cls).__new__(cls)
            # 初始化OCR读取器，支持中文和英文
            # 显式指定模型存储目录
            print(f"Reader初始化参数: languages={settings.OCR_LANGUAGES}, gpu={settings.USE_GPU}, model_dir={settings.MODEL_DIR}")
            cls._reader = easyocr.Reader(
                lang_list=settings.OCR_LANGUAGES, 
                gpu=settings.USE_GPU,
                model_storage_directory=settings.MODEL_DIR,
                # download_enabled=False,
                # detector=True,           # 使用已有的检测模型
                # recognizer=True          # 使用已有的识别模型
            )
        return cls._instance
    
    def process_image(self, image_base64: str):
        """处理Base64编码的图像并返回OCR结果"""
        start_time = time.time()
        
        # 解码Base64图像数据
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        image_np = np.array(image)
        
        # 执行OCR识别
        results = self._reader.readtext(image_np)
        
        # 提取文本和置信度
        recognized_text = ' '.join([text for (bbox, text, prob) in results])
        confidence = sum([prob for (bbox, text, prob) in results]) / len(results) if results else 0
        
        # 计算处理时间
        processing_time = time.time() - start_time
        
        return {
            'text': recognized_text,
            'confidence': float(confidence),
            'words': len(results),
            'lines': 1,  # EasyOCR不直接提供行数，这里简化处理
            'paragraphs': 1,  # 简化处理
            'processing_time': processing_time
        }