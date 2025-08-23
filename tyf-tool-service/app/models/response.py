from typing import Any, Optional
from pydantic import BaseModel, Field

class StandardResponse(BaseModel):
    code: int = Field(0, description="响应状态码，0表示成功，其他值表示错误")
    data: Optional[Any] = Field(None, description="响应数据，可以是任何类型，包括对象、数组等")
    msg: Optional[str] = Field(None, description="响应消息，通常在发生错误时提供错误信息")

def success_response(data: Any = None, msg: str = None) -> StandardResponse:
    """
    创建成功响应
    
    参数:
        data: 响应数据，可选
        msg: 响应消息，可选，默认为None
        
    返回:
        StandardResponse: 状态码为0的成功响应对象
    """
    return StandardResponse(code=0, data=data, msg=msg)

def error_response(code: int = 500, data: Any = None, msg: str = None) -> StandardResponse:
    """
    创建错误响应
    
    参数:
        code: 错误状态码，可选，默认为500
        data: 错误相关数据，可选
        msg: 错误消息，可选
        
    返回:
        StandardResponse: 包含错误信息的响应对象
    """
    return StandardResponse(code=code, data=data, msg=msg)