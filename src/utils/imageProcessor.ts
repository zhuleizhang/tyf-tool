import * as fs from 'fs';
import * as path from 'path';

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ProcessedImageData {
  base64: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * 获取图片的MIME类型
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * 检查文件是否为支持的图片格式
 */
export function isSupportedImageFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'];
  return supportedFormats.includes(ext);
}

/**
 * 获取文件大小（字节）
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
}

/**
 * 将图片转换为base64格式
 * 由于Node.js环境限制，这里只进行基本的文件读取和base64转换
 * 实际的图片压缩需要使用专门的图片处理库
 */
export async function processImageToBase64(
  imagePath: string, 
  options: ImageProcessingOptions = {}
): Promise<ProcessedImageData> {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在: ${imagePath}`);
    }

    // 检查是否为支持的图片格式
    if (!isSupportedImageFormat(imagePath)) {
      throw new Error(`不支持的图片格式: ${path.extname(imagePath)}`);
    }

    // 获取原始文件大小
    const originalSize = getFileSize(imagePath);
    
    // 读取文件
    const imageBuffer = fs.readFileSync(imagePath);
    
    // 转换为base64
    const base64String = imageBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);
    
    // 计算压缩后大小（base64编码会增加约33%的大小）
    const compressedSize = Math.ceil(base64String.length * 0.75);
    
    // 由于没有图片处理库，无法获取实际尺寸，使用默认值
    const dimensions = {
      width: options.maxWidth || 300,
      height: options.maxHeight || 200
    };

    return {
      base64: base64String,
      mimeType,
      originalSize,
      compressedSize,
      dimensions
    };

  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error(`图片处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 批量处理图片
 */
export async function processImagesInBatch(
  imagePaths: string[], 
  options: ImageProcessingOptions = {},
  progressCallback?: (completed: number, total: number, currentFile: string) => void
): Promise<(ProcessedImageData | null)[]> {
  const results: (ProcessedImageData | null)[] = [];
  const total = imagePaths.length;

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    
    try {
      // 调用进度回调
      if (progressCallback) {
        progressCallback(i, total, imagePath);
      }

      // 处理单张图片
      const processedImage = await processImageToBase64(imagePath, options);
      results.push(processedImage);

    } catch (error) {
      console.error(`Failed to process image ${imagePath}:`, error);
      results.push(null);
    }

    // 添加小延迟避免阻塞
    if (i < imagePaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // 最终进度回调
  if (progressCallback) {
    progressCallback(total, total, '');
  }

  return results;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * 检查图片文件是否过大
 */
export function isImageTooLarge(filePath: string, maxSizeMB: number = 10): boolean {
  try {
    const sizeBytes = getFileSize(filePath);
    const sizeMB = sizeBytes / (1024 * 1024);
    return sizeMB > maxSizeMB;
  } catch (error) {
    return false;
  }
}

/**
 * 生成图片缩略图信息（用于Excel中显示）
 */
export function generateImageThumbnailInfo(imagePath: string): {
  name: string;
  size: string;
  type: string;
  path: string;
} {
  const name = path.basename(imagePath);
  const size = formatFileSize(getFileSize(imagePath));
  const type = getMimeType(imagePath);
  
  return {
    name,
    size,
    type,
    path: imagePath
  };
}