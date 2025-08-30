# TYF-Tool 服务

一个基于 FastAPI 和 EasyOCR 的高效文字识别服务，支持中英文混合识别，提供现代化的 RESTful API 接口和自动文档。

## 功能特点

-   📚 支持中文简体和英文文本识别
-   ⚡ 提供高性能的图像文本提取能力
-   🌐 现代化的 FastAPI RESTful 接口
-   📝 自动生成交互式 API 文档
-   🔍 请求和响应数据自动验证
-   🖼️ 支持 Base64 编码图像输入
-   📊 返回识别结果、置信度等详细信息
-   💻 支持 GPU 加速（可配置）

## 技术栈

-   **Web 框架**: FastAPI 0.104.0
-   **ASGI 服务器**: Uvicorn 0.23.2
-   **OCR 引擎**: EasyOCR 1.7.0
-   **图像处理**: Pillow 11.3.0, NumPy 1.26.0
-   **数据验证**: Pydantic 2.4.2
-   **Python 版本**: 3.7+ (推荐 3.8 或更高版本)

## 配置环境变量

```bash
# python@3.9
# Python和pip命令别名
alias python=python3
alias pip=pip3
```

## 安装指南

1. 克隆项目

```bash
git clone <项目地址>
cd tyf-tool-service
```

2. 安装依赖

```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
# 阿里云：https://mirrors.aliyun.com/pypi/simple/
# 豆瓣：https://pypi.doubanio.com/simple/
# 腾讯云：https://mirrors.cloud.tencent.com/pypi/simple/
```

or

```bash
# 1. 进入项目目录
cd /Users/zhangzhulei/Desktop/projects/tyf-tool/tyf-tool-service

# 2. 创建 Python 虚拟环境
python3 -m venv venv

# 3. 激活虚拟环境
source venv/bin/activate

# 4. 安装项目依赖
pip install -r requirements.txt
```

3. 收集依赖(可选)

```bash
pip install pipreqs
pipreqs ./tyf-tool-service
```

## 使用方法

1. 启动服务

```bash
python main.py
```

2. 访问 API 文档

打开浏览器访问: http://localhost:8000/docs

3. API 调用示例

```bash
curl -X POST "http://localhost:8000/api/v1/recognize" \
     -H "Content-Type: application/json" \
     -d '{"image_base64":"YOUR_BASE64_ENCODED_IMAGE"}'
```

## API 文档

服务启动后，可以访问以下 URL 查看详细 API 文档：

-   Swagger UI: http://localhost:8000/docs
-   ReDoc: http://localhost:8000/redoc

## 打包

```bash
# pip install pyinstaller -i https://pypi.tuna.tsinghua.edu.cn/simple
pyinstaller --onefile --name tyf_tool_service main.py
```

OR

```bash
pyinstaller tyf_tool_service.spec
```

## 运行

```bash
./dist/tyf_tool_service
```
