from flask import Flask, request, jsonify
import easyocr
import numpy as np
from PIL import Image
import io
import base64
import os

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

app = Flask(__name__)


# 获取当前工作目录
current_dir = os.getcwd()
# 构建相对路径
model_dir = os.path.join(current_dir, 'easyocr_models')
# 设置环境变量
os.environ['EASYOCR_MODULE_PATH'] = model_dir

# 初始化OCR读取器，支持中文和英文
# 第一次加载会下载模型，可能需要一些时间
reader = easyocr.Reader(['ch_sim', 'en'], gpu=True)  # 如果没有GPU，可以设置为False

@app.route('/recognize', methods=['POST'])
def recognize_image():
    try:
        # 获取请求数据
        data = request.json
        if not data or 'image_base64' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        # 解码Base64图像数据
        image_data = base64.b64decode(data['image_base64'])
        image = Image.open(io.BytesIO(image_data))
        image_np = np.array(image)

        # 可选：预处理图像以提高识别准确率
        # 这里可以根据需要添加图像处理逻辑

        # 执行OCR识别
        results = reader.readtext(image_np)

        # 提取文本和置信度
        recognized_text = ' '.join([text for (bbox, text, prob) in results])
        confidence = sum([prob for (bbox, text, prob) in results]) / len(results) if results else 0

        # 返回识别结果
        return jsonify({
            'text': recognized_text,
            'confidence': float(confidence),
            'words': len(results),
            'lines': 1,  # EasyOCR不直接提供行数，这里简化处理
            'paragraphs': 1,  # 简化处理
            'processing_time': 0  # 可以添加实际处理时间
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 在生产环境中，请使用更安全的配置和WSGI服务器
    app.run(host='0.0.0.0', port=8000, debug=False)