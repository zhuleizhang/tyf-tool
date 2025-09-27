# 商品条码识别脚本使用说明

本项目提供了两个独立的商品条码识别脚本，可以从Excel文件中提取条码图片，识别条码并调用不同的API查询商品信息，类似微信扫一扫功能。

## 脚本说明

### 1. barcode_scanner_mxnzp.py
- 使用MXNZP API进行商品信息查询
- 需要申请专属API密钥
- 内置QPS限制（1秒1次请求）
- 返回6个基础字段

### 2. barcode_scanner_tianapi.py
- 使用天聚数行(TianAPI)进行商品信息查询
- 提供免费测试额度
- 返回13个详细字段
- 无QPS限制

## 功能特点

- 支持从Excel文件中读取条码图片
- 使用pyzbar库识别多种条码格式（EAN8、EAN13、Code128等）
- 自动将商品信息按字段分别填入Excel的不同列中
- 支持处理多个图片列
- 提供详细的错误处理和日志输出

## 依赖安装

在使用脚本之前，请确保安装以下依赖：

### 1. 安装系统依赖（macOS）

```bash
# 使用Homebrew安装zbar库
brew install zbar
```

### 2. 安装Python库

```bash
pip install openpyxl pillow pyzbar requests
```

**注意：** pyzbar库需要依赖zbar系统库才能正常工作。脚本已自动处理macOS Homebrew环境下的库路径设置。

**其他系统：**
- **Ubuntu/Debian:** `sudo apt-get install libzbar0`
- **Windows:** 下载并安装 zbar 库，或使用预编译的 wheel 包

### 3. 验证安装

运行以下命令验证所有依赖是否正确安装：

```bash
python -c "from pyzbar import pyzbar; print('pyzbar安装成功！')"
```

## 使用方法

### MXNZP API版本

```bash
# 基本语法
python scripts/barcode_scanner_mxnzp.py <Excel文件> --image-cols <图片列号> --app-id <应用ID> --app-secret <应用密钥>

# 处理单列条码图片
python scripts/barcode_scanner_mxnzp.py data.xlsx --image-cols 2 --app-id YOUR_APP_ID --app-secret YOUR_APP_SECRET

# 处理多列条码图片
python scripts/barcode_scanner_mxnzp.py data.xlsx --image-cols 2 3 4 --app-id YOUR_APP_ID --app-secret YOUR_APP_SECRET

# 指定输出文件名
python scripts/barcode_scanner_mxnzp.py data.xlsx --image-cols 2 --app-id YOUR_APP_ID --app-secret YOUR_APP_SECRET --output result.xlsx
```

### 天聚数行API版本

```bash
# 基本语法
python scripts/barcode_scanner_tianapi.py <Excel文件> --image-cols <图片列号> --tianapi-key <API密钥>

# 处理单列条码图片
python scripts/barcode_scanner_tianapi.py data.xlsx --image-cols 2 --tianapi-key YOUR_API_KEY

# 处理多列条码图片
python scripts/barcode_scanner_tianapi.py data.xlsx --image-cols 2 3 4 --tianapi-key YOUR_API_KEY

# 指定输出文件名
python scripts/barcode_scanner_tianapi.py data.xlsx --image-cols 2 --tianapi-key YOUR_API_KEY --output result.xlsx
```

### 命令行参数说明

#### MXNZP版本参数
- `excel_file`: 包含条码图片的Excel文件路径（必需）
- `--image-cols`: 包含条码图片的列号，从1开始计数，可指定多列（必需）
- `--app-id`: MXNZP API的应用ID（必需）
- `--app-secret`: MXNZP API的应用密钥（必需）
- `--api-url`: API地址（可选，默认使用官方地址）
- `--output`: 输出文件名（可选，默认为原文件名加前缀）

#### 天聚数行版本参数
- `excel_file`: 包含条码图片的Excel文件路径（必需）
- `--image-cols`: 包含条码图片的列号，从1开始计数，可指定多列（必需）
- `--tianapi-key`: 天聚数行API的密钥（必需）
- `--output`: 输出文件名（可选，默认为原文件名加前缀）

### API提供商说明

#### 1. 天聚数行（tianapi）- 推荐
- **优势：** 免费注册即可获得100次测试额度
- **申请地址：** https://www.tianapi.com/
- **使用方法：** 注册账号 → 申请条码查询API → 获取密钥

#### 2. mxnzp
- **优势：** 数据较全面
- **申请地址：** https://www.mxnzp.com/
- **使用方法：** 注册账号 → 申请API密钥 → 获取app_id和app_secret

## 示例用法

### 1. 使用天聚数行API（推荐）

```bash
# 基本用法 - 需要先申请tianapi密钥
python scripts/barcode_scanner.py /path/to/商品条码.xlsx --tianapi-key "your_tianapi_key"

# 指定列号
python scripts/barcode_scanner.py /path/to/商品条码.xlsx \
  --tianapi-key "your_tianapi_key" \
  --image-cols 3 --result-cols 4
```

### 2. 使用mxnzp API

```bash
# 使用mxnzp API
python scripts/barcode_scanner.py /path/to/商品条码.xlsx \
  --api-provider mxnzp \
  --app-id "your_app_id" \
  --app-secret "your_app_secret"
```

### 3. 批量处理多列

```bash
# 同时处理多列条码图片（使用tianapi）
python scripts/barcode_scanner.py /path/to/商品条码.xlsx \
  --tianapi-key "your_tianapi_key" \
  --image-cols 1 3 5 --result-cols 2 4 6
```

### 4. 自定义输出文件

```bash
# 指定输出文件名
python scripts/barcode_scanner.py /path/to/商品条码.xlsx \
  --tianapi-key "your_tianapi_key" \
  --output /path/to/处理结果.xlsx
```

### 5. 快速开始（获取API密钥）

**天聚数行API密钥申请步骤：**
1. 访问 https://www.tianapi.com/ 注册账号
2. 登录后进入控制台
3. 找到"条码查询"API并申请
4. 获取API Key后使用以下命令：

```bash
python scripts/barcode_scanner.py /path/to/商品条码.xlsx --tianapi-key "你的API密钥"
```

## Excel 文件格式要求

### 输入文件格式
- Excel 文件格式：`.xlsx` 或 `.xls`
- 条码图片应直接插入到 Excel 单元格中
- 图片格式支持：PNG、JPG、JPEG、BMP 等常见格式
- 条码图片应清晰可读，建议分辨率不低于 300x100 像素

## 输出结果说明

两个脚本都会自动检测Excel文件的最后一列位置，并从下一列开始写入商品信息。不同脚本返回的字段数量不同：

### MXNZP版本返回字段（6列）
1. 商品名称 (goodsName)
2. 条码 (barcode)
3. 价格 (price)
4. 品牌 (brand)
5. 供应商 (supplier)
6. 规格 (standard)

### 天聚数行版本返回字段（13列）
1. 商品名称 (name)
2. 条码 (barcode)
3. 规格 (spec)
4. 品牌 (brand)
5. 厂商名称 (firm_name)
6. 厂商地址 (firm_address)
7. 厂商状态 (firm_status)
8. 毛重 (gross_weight)
9. 宽度 (width)
10. 高度 (height)
11. 深度 (depth)
12. 商品类型 (goods_type)
13. 商品图片 (goods_pic)

#### 自动列检测

- 脚本会自动检测Excel文件的最后一列位置
- 从最后一列的下一列开始写入商品信息
- 第1行会自动添加列标题
- 如果条码识别失败或API查询失败，会在第一个字段列显示错误信息

## 注意事项

### 1. API 使用限制
- 脚本使用的是免费 API，有一定的调用频率限制
- 建议申请自己的 API 密钥：https://www.mxnzp.com
- 免费版本可能有每日调用次数限制

### 2. 条码识别要求
- 条码图片需要清晰、完整
- 支持的条码格式：EAN-13、EAN-8、UPC-A、UPC-E、Code 128、Code 39 等
- 图片中条码应占据足够大的比例
- 避免图片模糊、倾斜或部分遮挡

1. **依赖安装**：确保已安装所有必需的依赖库
2. **图片格式**：支持常见的图片格式（PNG、JPG、BMP等）
3. **条码清晰度**：条码图片需要足够清晰，模糊的图片可能无法识别
4. **API限制**：
   - MXNZP API有QPS限制，脚本已自动控制为1秒1次请求
   - 天聚数行API有免费额度限制（100次测试）
5. **网络连接**：需要稳定的网络连接来调用API
6. **Excel格式**：支持.xlsx格式的Excel文件
7. **列号计数**：列号从1开始计数（A列=1，B列=2，以此类推）
8. **脚本选择**：根据需要的字段详细程度和API偏好选择对应的脚本

## 常见问题解决方案

### Q1: 提示 "请先安装pyzbar库"
**解决方案：**
```bash
pip install pyzbar
# 如果还是报错，尝试安装系统依赖
# macOS: brew install zbar
# Ubuntu: sudo apt-get install libzbar0
```

### Q2: 条码识别失败
**可能原因和解决方案：**
- 图片质量不佳：使用更清晰的条码图片
- 条码格式不支持：确认条码格式是否为常见格式
- 图片中条码太小：使用更大尺寸的条码图片

### Q3: API 查询失败 - "app_id或者app_secret不合法"
**可能原因和解决方案：**
- **天聚数行API返回"数据返回为空"**：
  - 确保使用正确的API密钥
  - 检查条码格式是否正确（13位数字）
  - 确认API额度是否充足
  - 某些商品可能在数据库中不存在
- **mxnzp API返回"app_id或者app_secret不合法"**：
  - 需要申请专属的API密钥，不能使用测试密钥
  - 访问 https://www.mxnzp.com/ 申请
- API密钥配置错误：使用天聚数行API时添加 `--tianapi-key "你的密钥"`
- mxnzp API配置错误：确保 `--app-id` 和 `--app-secret` 正确
- API额度用完：登录对应平台查看剩余调用次数
- 网络连接问题：检查网络连接
- 条码不在数据库中：某些商品可能未收录在查询数据库中

### Q3.1: 最新修复
- **v1.1**: 修复了天聚数行API参数错误问题（'code' -> 'barcode'）
- **v1.0**: 修复了pyzbar库导入问题

### Q4: 如何选择API提供商？
**建议：**
- **天聚数行（tianapi）：** 免费100次测试，适合小量测试
- **mxnzp：** 数据较全面，适合大量使用

### Q: 提示"module 'pyzbar' has no attribute 'decode'"错误
A: 这是pyzbar库导入问题，请确保：
1. 已正确安装zbar系统库：`brew install zbar`（macOS）
2. 已安装pyzbar：`pip install pyzbar`
3. 重启终端后再试

### Q: API返回错误信息
A: 请检查：
1. API密钥是否正确
2. 是否已申请对应API的使用权限
3. 网络连接是否正常
4. API额度是否已用完

### Q: 识别不到条码
A: 可能的原因：
1. 图片中的条码不够清晰
2. 条码格式不支持
3. 图片尺寸过小或过大

### Q: Excel文件保存失败
A: 可能的原因：
1. 文件正在被其他程序占用
2. 没有写入权限
3. 磁盘空间不足

### Q: 如何选择使用哪个脚本？
A: 选择建议：
- 需要详细商品信息（13个字段）：使用tianapi版本
- 只需要基础信息（6个字段）：使用mxnzp版本
- 有免费测试需求：优先选择tianapi版本
- 需要长期稳定使用：建议申请mxnzp专属密钥

## API 密钥申请指南

### MXNZP API
1. 访问 [MXNZP官网](https://www.mxnzp.com/)
2. 注册账号并登录
3. 申请条码查询API的专属密钥
4. 获取app_id和app_secret
5. 注意：该API有QPS限制，脚本已自动控制请求频率

### 天聚数行API
1. 访问 [天聚数行官网](https://www.tianapi.com/)
2. 注册账号并登录
3. 申请条码查询API（提供免费100次测试）
4. 获取API密钥
5. 注意：免费额度用完后需要付费购买

### 📋 其他API提供商

- **聚合数据**：https://www.juhe.cn/
- **APISpace**：https://www.apispace.com/
- **阿里云市场**：https://market.aliyun.com/

**注意：** 使用其他API需要修改脚本中的API调用逻辑。

## 技术支持

如果遇到其他问题，可以：
1. 检查错误信息和日志输出
2. 确认所有依赖库已正确安装
3. 验证 Excel 文件格式和图片质量
4. 测试网络连接和 API 可用性

---

**注意：** 本脚本仅供学习和研究使用，请遵守相关 API 的使用条款和法律法规。