import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { message } from 'antd';
import type { ImageData } from '../index';
import { RecognizeOptions, Rectangle } from 'tesseract.js';

interface OCRProgress {
	imagePath: string;
	progress: number;
	status: 'starting' | 'processing' | 'completed' | 'error';
	error?: string;
}

interface BatchOCRProgress {
	total: number;
	completed: number;
	current?: string;
	status: 'starting' | 'processing' | 'completed' | 'error';
	error?: string;
}

interface OCRResult {
	text: string;
	confidence: number;
	words: number;
	lines: number;
	paragraphs: number;
}

// 获取图片尺寸的辅助函数
const getImageDimensions = (
	file: File
): Promise<{ width: number; height: number }> => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve({
				width: img.naturalWidth,
				height: img.naturalHeight,
			});
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('无法加载图片以获取尺寸'));
		};

		img.src = url;
	});
};

// OCR缓存
const ocrCache = new Map<string, { result: OCRResult; timestamp: number }>();
const CACHE_EXPIRY = 30 * 60 * 1000; // 30分钟缓存

export const useImageOCR = (
	images: ImageData[],
	updateImageText: (
		id: string,
		text: string,
		status?: ImageData['status'],
		confidence?: number
	) => void
) => {
	const [isProcessing, setIsProcessing] = useState(false);
	const [progress, setProgress] = useState(0);
	const [currentProcessing, setCurrentProcessing] = useState<string>('');
	const [ocrStats, setOCRStats] = useState({
		totalProcessed: 0,
		totalTime: 0,
		avgConfidence: 0,
	});

	const abortControllerRef = useRef<AbortController | null>(null);
	const progressCleanupRef = useRef<(() => void) | null>(null);
	const processingStartTimeRef = useRef<number>(0);

	// 计算待处理图片数量
	const pendingCount = useMemo(
		() =>
			images.filter(
				(img) => img.status === 'pending' || img.status === 'error'
			).length,
		[images]
	);

	// 清理过期缓存
	const cleanExpiredCache = useCallback(() => {
		const now = Date.now();
		for (const [key, value] of ocrCache.entries()) {
			if (now - value.timestamp > CACHE_EXPIRY) {
				ocrCache.delete(key);
			}
		}
	}, []);

	// 获取缓存键
	const getCacheKey = useCallback(
		(imageUrl: string, fileSize: number): string => {
			return `${imageUrl}_${fileSize}`;
		},
		[]
	);

	// 设置OCR进度监听
	useEffect(() => {
		if (!window.electronAPI?.onOCRProgress) return;

		const cleanup = window.electronAPI.onOCRProgress(
			(data: OCRProgress) => {
				const image = images.find(
					(img) => img.file.name === data.imagePath
				);
				if (!image) return;

				if (data.status === 'starting') {
					updateImageText(image.id, image.text, 'processing');
				} else if (data.status === 'completed') {
					updateImageText(image.id, image.text, 'completed');
				} else if (data.status === 'error') {
					updateImageText(image.id, image.text, 'error');
					message.error(`图片识别失败: ${data.error}`, 3);
				}
			}
		);

		progressCleanupRef.current = cleanup;

		return () => {
			if (progressCleanupRef.current) {
				progressCleanupRef.current();
			}
		};
	}, [images, updateImageText]);

	// 定期清理缓存
	useEffect(() => {
		const interval = setInterval(cleanExpiredCache, 5 * 60 * 1000); // 每5分钟清理一次
		return () => clearInterval(interval);
	}, [cleanExpiredCache]);

	const recognizeImage = useCallback(
		async (
			imageId: string,
			options: Partial<RecognizeOptions> & { language?: string } = {}
		): Promise<OCRResult> => {
			const image = images.find((img) => img.id === imageId);
			if (!image) {
				throw new Error('图片不存在');
			}

			const startTime = Date.now();

			try {
				// 检查缓存
				const cacheKey = getCacheKey(image.url, image.file.size);
				const cached = ocrCache.get(cacheKey);

				if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
					console.log('使用OCR缓存结果');
					updateImageText(
						imageId,
						cached.result.text,
						'completed',
						cached.result.confidence
					);
					return cached.result;
				}

				// 更新状态为处理中
				updateImageText(imageId, image.text, 'processing');
				setCurrentProcessing(image.file.name);

				// 获取图片实际尺寸并计算识别区域
				const imageDimensions = await getImageDimensions(image.file);
				const imageWidth = imageDimensions.width;
				const imageHeight = imageDimensions.height;

				// 根据公式计算识别区域
				const left = Math.floor(imageWidth * 0.15);
				const top = Math.floor(imageHeight * 0.7);
				const width = imageWidth - left;
				const height = imageHeight - top;

				// 构建矩形区域对象
				const rectangle: Rectangle = {
					left,
					top,
					width,
					height,
				};

				// 将File对象转换为ArrayBuffer
				const imageData = await image.file.arrayBuffer();

				// OCR选项（语言参数将在主进程中处理）
				const ocrOptions = {
					...options,
					// psm: options.psm || 6, // 页面分割模式：假设一个统一的文本块
					// oem: options.oem || 1, // OCR引擎模式：使用LSTM神经网络
					// 基础选项
					// tessedit_char_whitelist: options.whitelist || undefined,
					// tessedit_pageseg_mode: options.pageSegMode || 6,
					preserve_interword_spaces: '1',
					// 语言参数
					language: options.language || 'chi_sim',
					// rectangle: rectangle, // 传递矩形区域数组
				};

				console.log(
					image.id,
					image.file.name,
					ocrOptions,
					`${image.file.name} ocrOptions`
				);

				// 调用主进程OCR服务，传递ArrayBuffer数据、文件名和OCR选项
				const result = await window.electronAPI?.recognizeImage?.(
					imageData,
					image.file.name,
					ocrOptions
				);

				console.log(
					image.file.name,
					result,
					`${image.file.name} result`
				);

				if (!result || !result.text) {
					throw new Error('识别结果为空');
				}

				const ocrResult: OCRResult = {
					text: result.text,
					confidence: result.confidence,
					words: result.words,
					lines: result.lines,
					paragraphs: result.paragraphs,
				};

				// 缓存结果
				ocrCache.set(cacheKey, {
					result: ocrResult,
					timestamp: Date.now(),
				});

				// 更新文本和状态
				updateImageText(
					imageId,
					result.text,
					'completed',
					result.confidence
				);

				// 更新统计信息
				const processingTime = Date.now() - startTime;
				setOCRStats((prev) => ({
					totalProcessed: prev.totalProcessed + 1,
					totalTime: prev.totalTime + processingTime,
					avgConfidence:
						(prev.avgConfidence * prev.totalProcessed +
							result.confidence) /
						(prev.totalProcessed + 1),
				}));

				// 显示识别结果信息
				console.log(
					`OCR完成 - 置信度: ${(result.confidence * 100).toFixed(
						1
					)}%, 词数: ${result.words}, 耗时: ${processingTime}ms`
				);

				return ocrResult;
			} catch (error) {
				console.error('OCR recognition error:', error);
				updateImageText(imageId, image.text, 'error');

				// 更详细的错误处理
				const errorMessage =
					error instanceof Error ? error.message : '未知错误';
				if (errorMessage.includes('网络')) {
					message.error('网络连接失败，请检查网络后重试', 5);
				} else if (errorMessage.includes('内存')) {
					message.error('内存不足，请关闭其他应用后重试', 5);
				} else if (errorMessage.includes('格式')) {
					message.error(
						'图片格式不支持，请使用JPG、PNG等常见格式',
						5
					);
				} else {
					message.error(`识别失败: ${errorMessage}`, 5);
				}

				throw error;
			} finally {
				setCurrentProcessing('');
			}
		},
		[images, updateImageText, getCacheKey]
	);

	const recognizeAll = useCallback(
		async (options: any = {}) => {
			if (images.length === 0) {
				message.warning('请先上传图片');
				return;
			}

			const pendingImages = images.filter(
				(img) => img.status === 'pending' || img.status === 'error'
			);

			if (pendingImages.length === 0) {
				message.info('所有图片已完成识别');
				return;
			}

			setIsProcessing(true);
			setProgress(0);
			processingStartTimeRef.current = Date.now();

			// 创建中止控制器
			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			try {
				// 设置批量OCR进度监听
				let batchCleanup: (() => void) | null = null;
				if (window.electronAPI?.onBatchOCRProgress) {
					batchCleanup = window.electronAPI.onBatchOCRProgress(
						(data: BatchOCRProgress) => {
							const currentProgress =
								(data.completed / data.total) * 100;
							setProgress(currentProgress);

							if (data.current) {
								setCurrentProcessing(data.current);
							}

							if (data.status === 'error') {
								message.error(`批量识别出错: ${data.error}`, 5);
							}
						}
					);
				}

				// 针对中文OCR优化的并发控制：降低并发数提高单张图片处理质量
				const systemConcurrency = navigator.hardwareConcurrency || 4;
				const concurrencyLimit = Math.min(
					Math.max(1, Math.floor(systemConcurrency / 4)), // 使用四分之一的CPU核心，避免资源竞争
					2, // 最大不超过2个并发，确保每个OCR任务有足够资源
					pendingImages.length
				);

				console.log(
					`使用 ${concurrencyLimit} 个并发处理 ${pendingImages.length} 张图片（中文优化模式）`
				);

				const results = [];
				let completed = 0;

				// 分批处理
				for (
					let i = 0;
					i < pendingImages.length;
					i += concurrencyLimit
				) {
					if (abortController.signal.aborted) {
						break;
					}

					const batch = pendingImages.slice(i, i + concurrencyLimit);
					const batchPromises = batch.map(async (image, index) => {
						try {
							if (abortController.signal.aborted) {
								return null;
							}

							const result = await recognizeImage(
								image.id,
								options
							);
							completed++;

							// 更新进度
							const currentProgress =
								(completed / pendingImages.length) * 100;
							setProgress(currentProgress);

							return { success: true, result, imageId: image.id };
						} catch (error) {
							console.error(
								`Failed to recognize image ${image.id}:`,
								error
							);
							completed++;

							// 更新进度
							const currentProgress =
								(completed / pendingImages.length) * 100;
							setProgress(currentProgress);

							return { success: false, error, imageId: image.id };
						}
					});

					const batchResults = await Promise.allSettled(
						batchPromises
					);
					results.push(...batchResults);

					// 中文OCR优化延迟：给每批处理更多时间，提高识别质量
					if (i + concurrencyLimit < pendingImages.length) {
						const delay = Math.max(
							500,
							1000 - systemConcurrency * 100
						); // 增加延迟时间，确保OCR质量
						await new Promise((resolve) =>
							setTimeout(resolve, delay)
						);
					}
				}

				// 清理批量进度监听
				if (batchCleanup) {
					batchCleanup();
				}

				// 统计结果
				const successful = results.filter(
					(r) =>
						r.status === 'fulfilled' && r.value && r.value.success
				).length;
				const failed = results.length - successful;

				const totalTime = Date.now() - processingStartTimeRef.current;
				const avgTimePerImage = totalTime / pendingImages.length;

				if (successful > 0) {
					message.success(
						`批量识别完成: ${successful}张成功${
							failed > 0 ? `, ${failed}张失败` : ''
						}，耗时 ${(totalTime / 1000).toFixed(1)}秒`,
						8
					);
				} else {
					message.error('批量识别失败，请检查图片格式和系统资源');
				}

				console.log(
					`批量OCR统计: 成功${successful}张，失败${failed}张，平均每张${avgTimePerImage.toFixed(
						0
					)}ms`
				);
			} catch (error) {
				console.error('Batch recognition error:', error);
				message.error('批量识别过程中发生错误，请重试');
				throw error;
			} finally {
				setIsProcessing(false);
				setProgress(0);
				setCurrentProcessing('');
				abortControllerRef.current = null;
			}
		},
		[images, recognizeImage]
	);

	const cancelRecognition = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			message.info('已取消识别操作');
		}
		setIsProcessing(false);
		setProgress(0);
		setCurrentProcessing('');
	}, []);

	// 重置OCR工作器
	const resetOCRWorker = useCallback(async () => {
		try {
			// 清理缓存
			ocrCache.clear();

			await window.electronAPI?.resetOCRWorker?.();
			message.success('OCR引擎已重置，缓存已清理');

			// 重置统计信息
			setOCRStats({
				totalProcessed: 0,
				totalTime: 0,
				avgConfidence: 0,
			});
		} catch (error) {
			console.error('Failed to reset OCR worker:', error);
			message.error('OCR引擎重置失败');
		}
	}, []);

	// 清理缓存
	const clearCache = useCallback(() => {
		ocrCache.clear();
		message.success('OCR缓存已清理');
	}, []);

	return {
		recognizeImage,
		recognizeAll,
		cancelRecognition,
		resetOCRWorker,
		clearCache,
		isProcessing,
		progress,
		currentProcessing,
		pendingCount,
		ocrStats,
	};
};
