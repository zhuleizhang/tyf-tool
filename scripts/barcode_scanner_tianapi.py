#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
商品条码识别脚本 - 天聚数行API版本
从Excel文件中提取条码图片，识别条码并查询商品信息
使用天聚数行(TianAPI)进行商品信息查询
"""

import argparse
import os
import shutil
import sys
from io import BytesIO
from PIL import Image
import requests
from openpyxl import load_workbook

# macOS环境变量配置 - 设置zbar库路径
def setup_macos_environment():
    """为macOS系统设置zbar库环境变量"""
    if sys.platform == 'darwin':  # macOS
        # 常见的zbar库安装路径
        possible_paths = [
            '/opt/homebrew/opt/zbar/lib',  # Apple Silicon Mac (M1/M2)
            '/usr/local/opt/zbar/lib',     # Intel Mac
            '/opt/local/lib',              # MacPorts
        ]
        
        for zbar_path in possible_paths:
            if os.path.exists(zbar_path):
                current_path = os.environ.get('DYLD_LIBRARY_PATH', '')
                if zbar_path not in current_path:
                    if current_path:
                        os.environ['DYLD_LIBRARY_PATH'] = f"{zbar_path}:{current_path}"
                    else:
                        os.environ['DYLD_LIBRARY_PATH'] = zbar_path
                print(f"已设置zbar库路径: {zbar_path}")
                return True
        
        print("警告: 未找到zbar库，请确保已正确安装")
        return False
    return True

# 检查和导入依赖库
def check_dependencies():
    """检查所有必要的依赖库及其版本"""
    missing_deps = []
    version_info = []
    
    # 检查pyzbar
    try:
        from pyzbar import pyzbar
        try:
            import pyzbar
            version = getattr(pyzbar, '__version__', '未知版本')
            version_info.append(f"pyzbar: {version}")
        except:
            version_info.append("pyzbar: 版本未知")
        print("✓ pyzbar库导入成功")
    except ImportError as e:
        missing_deps.append(('pyzbar', str(e)))
    
    # 检查其他依赖
    deps_to_check = [
        ('PIL', 'Pillow'),
        ('openpyxl', 'openpyxl'),
        ('requests', 'requests')
    ]
    
    for module_name, package_name in deps_to_check:
        try:
            module = __import__(module_name)
            # 尝试获取版本信息
            version = 'unknown'
            for attr in ['__version__', 'version', 'VERSION']:
                if hasattr(module, attr):
                    version = getattr(module, attr)
                    if isinstance(version, tuple):
                        version = '.'.join(map(str, version))
                    break
            version_info.append(f"{package_name}: {version}")
            print(f"✓ {package_name}库导入成功")
        except ImportError as e:
            missing_deps.append((package_name, str(e)))
    
    # 显示版本信息
    if version_info:
        print("\n📦 依赖库版本信息:")
        for info in version_info:
            print(f"  {info}")
    
    if missing_deps:
        print("\n❌ 缺少以下依赖库:")
        for dep, error in missing_deps:
            print(f"  - {dep}: {error}")
        
        print("\n📋 解决方案:")
        print("1. 安装zbar系统库:")
        if sys.platform == 'darwin':
            print("   macOS: brew install zbar")
        elif sys.platform.startswith('linux'):
            print("   Ubuntu/Debian: sudo apt-get install libzbar0")
            print("   CentOS/RHEL: sudo yum install zbar")
        
        print("\n2. 安装Python依赖:")
        print("   pip install pyzbar openpyxl pillow requests")
        
        print("\n3. 如果仍有问题，请尝试:")
        print("   pip install --upgrade pyzbar")
        print("   pip install --force-reinstall pyzbar")
        
        if sys.platform == 'darwin':
            print("\n4. macOS特殊情况:")
            print("   export DYLD_LIBRARY_PATH=/opt/homebrew/opt/zbar/lib:$DYLD_LIBRARY_PATH")
            print("   或者")
            print("   export DYLD_LIBRARY_PATH=/usr/local/opt/zbar/lib:$DYLD_LIBRARY_PATH")
        
        return False
    
    return True

# 设置环境并检查依赖
setup_macos_environment()
if not check_dependencies():
    print("\n❌ 依赖检查失败，请按照上述说明安装缺少的依赖库")
    sys.exit(1)

# 导入条码识别库
try:
    from pyzbar import pyzbar
except ImportError:
    print("❌ pyzbar导入失败，请检查安装")
    sys.exit(1)

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description='从Excel文件中识别条码并查询商品信息（天聚数行API版本）',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python scripts/barcode_scanner_tianapi.py /Users/bytedance/Desktop/tgs/好客来超市-商品统计.xlsx --image-cols 2 --tianapi-key YOUR_API_KEY
  python scripts/barcode_scanner_tianapi.py /Users/bytedance/Desktop/tgs/好客来超市-商品统计.xlsx --image-cols 2 3 --tianapi-key YOUR_API_KEY --output result.xlsx

注意事项:
  - 需要先申请天聚数行API密钥（提供免费测试额度）
  - 商品信息将从Excel最后一列开始写入
  - 返回的商品信息字段比MXNZP更详细
        """
    )
    
    parser.add_argument('excel_file', help='包含条码图片的Excel文件路径')
    parser.add_argument('--image-cols', type=int, nargs='+', required=True,
                       help='包含条码图片的列号（从1开始计数），可指定多列')
    parser.add_argument('--output', help='输出文件名（默认为原文件名加前缀）')
    
    # 天聚数行API配置
    parser.add_argument('--tianapi-key', required=True, help='天聚数行API的密钥')
    
    return parser.parse_args()

def decode_barcode_from_image(image_data):
    """
    从图片数据中识别条码
    
    Args:
        image_data: 图片的二进制数据
    
    Returns:
        tuple: (条码数据, 条码类型) 或 (None, None)
    """
    try:
        # 将二进制数据转换为PIL图像对象
        image = Image.open(BytesIO(image_data))
        
        # 转换为RGB格式（确保兼容性）
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 使用pyzbar识别条码
        barcodes = pyzbar.decode(image)
        
        # 返回第一个识别到的条码
        if barcodes:
            barcode = barcodes[0]
            return barcode.data.decode('utf-8'), barcode.type
        else:
            return None, None
            
    except Exception as e:
        print(f"条码识别错误: {e}")
        return None, None

def query_product_info_tianapi(barcode, tianapi_key):
    """
    使用天聚数行API查询商品信息
    
    Args:
        barcode: 条码数据
        tianapi_key: 天聚数行API密钥
    
    Returns:
        dict: 包含查询结果的字典
    """
    try:
        # 天聚数行API地址
        api_url = "https://apis.tianapi.com/barcode/index"
        
        # 构建请求参数
        params = {
            'key': tianapi_key,
            'barcode': barcode  # 注意：天聚数行使用barcode参数而不是code
        }
        
        # 发送API请求
        print(f"    正在查询商品信息: {barcode}")
        response = requests.get(api_url, params=params, timeout=10)
        response.raise_for_status()
        
        # 解析JSON响应
        result = response.json()
        
        # 检查API响应状态
        if result.get('code') == 200 and result.get('result'):
            # 查询成功，返回商品信息
            return {
                'success': True,
                'data': result['result']
            }
        else:
            # 查询失败，返回错误信息
            error_msg = result.get('msg', '未知错误')
            return {
                'success': False,
                'error': f"API返回错误: {error_msg}"
            }
            
    except requests.exceptions.RequestException as e:
        # 网络请求错误
        return {
            'success': False,
            'error': f"网络请求失败: {str(e)}"
        }
    except Exception as e:
        # 其他错误
        return {
            'success': False,
            'error': f"查询商品信息时发生错误: {str(e)}"
        }

def main():
    """主函数"""
    # 获取命令行参数
    args = parse_args()
    
    # 验证Excel文件是否存在
    if not os.path.exists(args.excel_file):
        print(f"错误: 文件 {args.excel_file} 不存在")
        return
    
    # 配置信息
    EXCEL_FILE = args.excel_file
    IMAGE_COLUMNS = args.image_cols
    TIANAPI_KEY = args.tianapi_key
    
    # 打印配置信息
    print(f"条码图片列: {IMAGE_COLUMNS}")
    print(f"API地址: https://apis.tianapi.com/barcode/index")
    print(f"API密钥: {TIANAPI_KEY[:8]}...")
    
    # 设置输出文件名
    if args.output:
        output_file = args.output
    else:
        output_file = f"tianapi_条码查询结果_{os.path.basename(EXCEL_FILE)}"
    
    # 复制原始Excel文件
    print(f"创建Excel文件副本: {output_file}")
    shutil.copy2(EXCEL_FILE, output_file)
    
    # 加载原始工作簿（用于读取图片数据）
    print(f"正在读取原始Excel文件中的条码图片: {EXCEL_FILE}")
    source_wb = load_workbook(EXCEL_FILE)
    source_sheet = source_wb.active
    
    # 检测Excel的最后一列位置
    max_col = source_sheet.max_column
    start_col = max_col + 1  # 从最后一列的下一列开始写入
    
    # 定义天聚数行API返回的字段映射
    field_names = ['name', 'barcode', 'spec', 'brand', 'firm_name', 'firm_address', 
                  'firm_status', 'gross_weight', 'width', 'height', 'depth', 'goods_type', 'goods_pic']
    field_headers = ['商品名称', '条码', '规格', '品牌', '厂商名称', '厂商地址', 
                    '厂商状态', '毛重', '宽度', '高度', '深度', '商品类型', '商品图片']
    
    print(f"将从第 {start_col} 列开始写入 {len(field_names)} 个字段")
    
    # 收集条码识别和商品查询结果
    query_results = {}  # 格式: {行号: 商品信息结构化数据}
    image_positions = []
    
    # 获取所有图片的位置信息
    for idx, img in enumerate(source_sheet._images):
        row = img.anchor._from.row + 1  # 转换为1-indexed
        col = img.anchor._from.col + 1  # 转换为1-indexed
        image_positions.append((idx, row, col))
    
    # 处理每个图片列
    for image_col in IMAGE_COLUMNS:
        print(f"\n处理条码图片列 {image_col}")
        
        # 找出当前图片列中的所有图片
        column_images = [(idx, row, col) for idx, row, col in image_positions if col == image_col]
        
        if not column_images:
            print(f"警告: 列 {image_col} 中未找到图片")
            continue
        
        # 处理当前列的每个图片
        for idx, row, col in column_images:
            try:
                # 获取图片数据
                img = source_sheet._images[idx]
                img_data = img._data()
                
                # 识别条码
                barcode_data, barcode_type = decode_barcode_from_image(img_data)
                
                if barcode_data:
                    print(f"  行 {row}: 识别到条码 {barcode_data} (类型: {barcode_type})")
                    
                    # 查询商品信息
                    product_result = query_product_info_tianapi(barcode_data, TIANAPI_KEY)
                    
                    # 保存查询结果
                    query_results[row] = product_result
                    
                    if product_result.get('success'):
                        print(f"  商品信息查询成功")
                    else:
                        print(f"  查询失败: {product_result.get('error', '未知错误')}")
                    
                else:
                    print(f"  行 {row}: 未识别到条码")
                    query_results[row] = {'success': False, 'error': '未识别到条码'}
                
            except Exception as e:
                print(f"  处理行 {row} 图片时出错: {e}")
                query_results[row] = {'success': False, 'error': f'处理错误: {e}'}
    
    # 关闭原始工作簿
    source_wb.close()
    
    # 加载复制后的工作簿（用于写入结果）
    print(f"\n正在将商品信息写入到: {output_file}")
    target_wb = load_workbook(output_file, read_only=False, keep_vba=True, data_only=False, keep_links=True)
    target_sheet = target_wb.active
    
    # 写入列标题（第1行）
    for i, header in enumerate(field_headers):
        target_sheet.cell(row=1, column=start_col + i, value=header)
    
    # 将查询结果写入多列
    for row, result in query_results.items():
        if result.get('success') and result.get('data'):
            # 成功获取商品信息，按字段写入各列
            data = result['data']
            for i, field_name in enumerate(field_names):
                value = data.get(field_name, '')
                target_sheet.cell(row=row, column=start_col + i, value=value)
        else:
            # 查询失败，在第一列写入错误信息
            error_msg = result.get('error', '未知错误')
            target_sheet.cell(row=row, column=start_col, value=f"错误: {error_msg}")
            # 其他列留空
            for i in range(1, len(field_names)):
                target_sheet.cell(row=row, column=start_col + i, value='')
    
    # 保存结果
    try:
        target_wb.save(output_file)
        print(f"处理完成，结果已保存到 {output_file}")
        print(f"\n共处理 {len(query_results)} 个条码图片")
        success_count = sum(1 for result in query_results.values() if result.get('success'))
        print(f"成功查询到商品信息: {success_count} 个")
        print(f"查询失败: {len(query_results) - success_count} 个")
    except Exception as e:
        print(f"保存文件时出错: {e}")
        # 尝试使用另一种方式保存
        try:
            print("尝试使用替代方法保存文件...")
            temp_output = f"temp_{output_file}"
            target_wb.save(temp_output)
            target_wb.close()
            if os.path.exists(output_file):
                os.remove(output_file)
            os.rename(temp_output, output_file)
            print(f"使用替代方法保存成功: {output_file}")
        except Exception as e2:
            print(f"使用替代方法保存失败: {e2}")

if __name__ == "__main__":
    main()