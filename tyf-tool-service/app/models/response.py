from typing import Any, Optional
from pydantic import BaseModel, Field

class StandardResponse(BaseModel):
    code: int = Field(0, description="响应状态码，0表示成功，其他值表示错误")
    data: Optional[Any] = Field(None, description="响应数据，可以是任何类型，包括对象、数组等")
    msg: Optional[str] = Field(None, description="响应消息，通常在发生错误时提供错误信息")