/**
 * OCR服务的TypeScript类型定义
 * 基于FastAPI后端的模型定义
 */

import { StandardResponse } from '@/utils/request';

/**
 * OCR请求参数
 */
export interface OCRRequest {
	/** Base64编码的图像数据 */
	image_base64: string;
}

/**
 * OCR识别结果
 */
export interface OCRResult {
	/** 识别出的文本 */
	text: string;
	/** 识别的置信度 */
	confidence: number;
	/** 识别的单词数 */
	words: number;
	/** 识别的行数 */
	lines: number;
	/** 识别的段落数 */
	paragraphs: number;
	/** 处理时间(秒) */
	processing_time: number;
}
