from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api.api import api_router
from app.core.config import settings
from app.models.response import StandardResponse

def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        description="OCR服务 - 支持中英文文本识别",
        version="1.0.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 配置CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 全局异常处理
    @application.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=200,  # 始终返回200状态码
            content=StandardResponse(
                code=exc.status_code,
                msg=str(exc.detail)
            ).model_dump()
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=200,  # 始终返回200状态码
            content=StandardResponse(
                code=400,
                msg=f"请求参数验证错误: {str(exc)}",
            ).model_dump()
        )

    @application.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=200,  # 始终返回200状态码
            content=StandardResponse(
                code=500,
                msg=f"服务器内部错误: {str(exc)}",
            ).model_dump()
        )

    # 包含API路由
    application.include_router(api_router, prefix=settings.API_V1_STR)

    return application

app = create_application()