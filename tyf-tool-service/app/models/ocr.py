from pydantic import BaseModel, Field

class OCRRequest(BaseModel):
    image_base64: str = Field(..., description="Base64编码的图像数据")

class OCRResponse(BaseModel):
    text: str = Field(..., description="识别出的文本")
    confidence: float = Field(..., description="识别的置信度")
    words: int = Field(..., description="识别的单词数")
    lines: int = Field(..., description="识别的行数")
    paragraphs: int = Field(..., description="识别的段落数")
    processing_time: float = Field(..., description="处理时间(秒)")