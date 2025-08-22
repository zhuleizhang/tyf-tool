// 移除对path的导入
// import * as path from 'path';
import { OCR_SUPPORTED_FORMATS } from '../constants';

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
	// 不使用path模块，直接处理扩展名
	const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
	const mimeTypes: { [key: string]: string } = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.bmp': 'image/bmp',
		'.webp': 'image/webp',
		'.svg': 'image/svg+xml',
		'.tiff': 'image/tiff',
		'.tif': 'image/tiff',
		'.heic': 'image/heic',
	};
	return mimeTypes[ext] || 'image/jpeg';
}

/**
 * 检查文件是否为支持的图片格式
 */
export function isSupportedImageFormat(filePath: string): boolean {
	// 不使用path模块，直接处理扩展名
	const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
	return OCR_SUPPORTED_FORMATS.includes(ext);
}

/**
 * 将File对象转换为Base64字符串
 */
export const fileToBase64 = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			// 移除Data URL前缀（如：data:image/jpeg;base64,）
			const base64 = dataUrl.split(',')[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
};

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
