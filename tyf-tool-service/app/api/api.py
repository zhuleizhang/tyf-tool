from fastapi import APIRouter
from app.api.endpoints import ocr

api_router = APIRouter()
api_router.include_router(ocr.router, prefix="/ocr", tags=["OCR"])