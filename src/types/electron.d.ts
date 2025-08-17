import { RecognizeOptions } from 'tesseract.js';

export interface ElectronAPI {
	// 现有的Excel相关API
	selectFile: () => Promise<string | null>;
	readExcel: (filePath: string) => Promise<any>;
	exportResults: (data: any[], filePath: string) => Promise<boolean>;

	// 新增的OCR相关API
	selectImages: () => Promise<string[] | null>;
	recognizeImage: (
		imageData: ArrayBuffer,
		fileName: string,
		options?: Partial<RecognizeOptions>
	) => Promise<{
		tempFilePath?: string;
		rawText: string;
		text: string;
		confidence: number;
		words: number;
		lines: number;
		paragraphs: number;
		processingTime: number;
	} | null>;
	// recognizeImagesBatch: 已废弃，使用渲染进程中的批量处理逻辑
	exportOCRExcel: (
		data: any[],
		images: any[],
		imageBuffers?: { [key: string]: ArrayBuffer }
	) => Promise<boolean>;
	resetOCRWorker: () => Promise<boolean>;

	// 事件监听器
	on: (channel: string, callback: (event: any, data: any) => void) => void;
	removeListener: (
		channel: string,
		callback: (event: any, data: any) => void
	) => void;
	removeAllListeners: (channel: string) => void;

	// OCR进度监听（保持向后兼容）
	onOCRProgress: (callback: (data: any) => void) => () => void;
	onBatchOCRProgress: (callback: (data: any) => void) => () => void;
	onExportProgress: (callback: (data: any) => void) => () => void;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}
