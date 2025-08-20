# TYF-OCR 服务

一个基于 Flask 和 EasyOCR 的高效文字识别服务，支持中英文混合识别，提供简单易用的 RESTful API 接口。

## 功能特点

-   📚 支持中文简体和英文文本识别
-   ⚡ 提供高性能的图像文本提取能力
-   🌐 简单易用的 HTTP RESTful API 接口
-   🖼️ 支持 Base64 编码图像输入
-   📊 返回识别结果、置信度等详细信息
-   💻 支持 GPU 加速（可配置）

## 技术栈

-   **Web 框架**: Flask 2.3.2
-   **OCR 引擎**: EasyOCR 1.7.0
-   **图像处理**: Pillow 10.0.0, NumPy 1.24.3
-   **Python 版本**: 3.7+ (推荐 3.8 或更高版本)

## 安装指南

### 1. 克隆项目（如果适用）

```bash
git clone <repository-url>
cd tyf-ocr-service
```

### 2. 安装依赖

使用 pip 安装项目所需的依赖包：

```bash
# 使用清华大学镜像源
pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 或使用阿里云镜像源
pip3 install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# 或使用豆瓣镜像源
pip3 install -r requirements.txt -i https://pypi.douban.com/simple/
```

OR

```bash
# 先下载并安装预编译的opencv-python-headless
pip3 install opencv-python-headless -i https://pypi.tuna.tsinghua.edu.cn/simple --no-build-isolation

# 然后再安装其他依赖
pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

**注意**: EasyOCR 首次运行时会自动下载模型文件，可能需要一些时间和网络带宽。

## 使用方法

### 启动服务

```bash
python app.py
```

服务将在 `http://0.0.0.0:5000` 启动。在生产环境中，建议使用更安全的配置和 WSGI 服务器（如 Gunicorn）。

### API 调用示例

服务提供 `/recognize` 接口，支持 POST 请求，接收 JSON 格式数据：

#### 请求格式

```json
{
	"image_base64": "<Base64编码的图像数据>"
}
```

#### 响应格式

成功响应：

```json
{
	"text": "识别到的文本内容",
	"confidence": 0.95, // 平均置信度
	"words": 10, // 识别到的单词/字符数量
	"lines": 1, // 行数（简化处理）
	"paragraphs": 1, // 段落数（简化处理）
	"processing_time": 0 // 处理时间（可扩展）
}
```

错误响应：

```json
{
	"error": "错误信息"
}
```

#### Python 调用示例

```python
import requests
import base64

# 读取图像并转换为Base64
with open("test_image.jpg", "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

# 发送请求
url = "http://localhost:5000/recognize"
payload = {
    "image_base64": encoded_string
}
response = requests.post(url, json=payload)

# 处理响应
if response.status_code == 200:
    result = response.json()
    print(f"识别结果: {result['text']}")
    print(f"置信度: {result['confidence']}")
else:
    print(f"请求失败: {response.json()['error']}")
```

## 配置说明

在 `app.py` 文件中，可以根据需要修改以下配置：

1. **GPU 支持**：默认为启用 GPU 加速

    ```python
    reader = easyocr.Reader(['ch_sim', 'en'], gpu=True)  # 设置为 False 禁用 GPU
    ```

2. **服务端口**：默认使用 5000 端口

    ```python
    app.run(host='0.0.0.0', port=5000, debug=False)
    ```

3. **调试模式**：生产环境请保持禁用
    ```python
    app.run(host='0.0.0.0', port=5000, debug=False)  # 生产环境设为 False
    ```

## 性能优化建议

1. **图像预处理**：对于低质量图像，可以添加预处理逻辑以提高识别准确率
2. **批量处理**：对于大量图像，可以考虑实现批量处理接口
3. **模型缓存**：确保模型只被加载一次，避免重复加载开销
4. **异步处理**：对于大文件或高并发场景，可以考虑使用异步处理模式

## 注意事项

1. **首次启动**：首次运行服务时，会下载 OCR 模型文件，可能需要一些时间
2. **内存占用**：EasyOCR 模型较大，运行时会占用较多内存
3. **并发限制**：默认配置下不适合高并发场景，生产环境请使用 WSGI 服务器和负载均衡
4. **图像质量**：识别准确率很大程度上依赖于输入图像的质量
5. **生产环境**：在生产环境中，请关闭调试模式并使用适当的安全配置

## 扩展方向

1. 添加更多语言支持
2. 实现图像预处理功能以提高识别准确率
3. 增加批量处理接口
4. 集成数据库存储识别历史
5. 开发简单的前端界面

## License

[MIT](https://opensource.org/licenses/MIT)

---

如有任何问题或建议，请随时提交 issue 或联系项目维护者。
