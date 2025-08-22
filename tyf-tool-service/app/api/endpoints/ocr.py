from fastapi import APIRouter, HTTPException
from app.models.ocr import OCRRequest, OCRResponse
from app.models.response import StandardResponse, success_response, error_response
from app.services.ocr_service import OCRService

router = APIRouter()
ocr_service = OCRService()

@router.post("/recognize", response_model=StandardResponse, summary="识别图像中的文本")
async def recognize_image(request: OCRRequest):
    """识别Base64编码图像中的文本
    
    - **image_base64**: Base64编码的图像数据
    
    返回识别的文本内容、置信度和其他相关信息
    """
    try:
        result = ocr_service.process_image(request.image_base64)
        # 使用success_response替代直接构造StandardResponse
        return success_response(data=result)
    except Exception as e:
        # 选项1：使用error_response并返回
        return error_response(code=500, msg=str(e))
        
        # 选项2：继续使用HTTPException（让FastAPI处理）
        # raise HTTPException(status_code=500, detail=str(e))