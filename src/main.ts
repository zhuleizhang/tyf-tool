import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { createWorker } from 'tesseract.js';
import { 
  processImageToBase64, 
  processImagesInBatch, 
  formatFileSize, 
  generateImageThumbnailInfo,
  isImageTooLarge,
  getMimeType 
} from './utils/imageProcessor';

// 删除以下两行
// import { fileURLToPath } from 'url';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// let mainWindow: BrowserWindow | null = null;

// function logError(error: Error) {
// 	// 使用__dirname直接定位项目根目录
// 	const projectRoot = path.join(__dirname, '..');
// 	const logFilePath = path.join(projectRoot, 'electron-app-error.log');
// 	const logMessage = `${new Date().toISOString()} - ${
// 		error.stack || error.message
// 	}\n`;

// 	console.log(logFilePath, 'logFilePath');

// 	fs.appendFile(logFilePath, logMessage, (err) => {
// 		if (err) {
// 			console.error('Failed to write to log file:', err);
// 		}
// 	});
// }

function createWindow() {
	console.log('Creating main window...');
	const mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	// 修改为正确的相对路径
	const htmlPath = path.join(__dirname, 'index.html');
	console.log('Loading HTML from:', htmlPath);
	mainWindow.loadFile(htmlPath);

	if (process.env.NODE_ENV === 'development') {
		mainWindow.webContents.openDevTools();
	}

	// 添加错误处理
	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
		console.error('Failed to load:', errorCode, errorDescription);
	});

	mainWindow.webContents.on('dom-ready', () => {
		console.log('DOM ready');
	});

	// // 添加此行强制打开开发者工具
	// mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
	try {
		console.log('App is ready, creating window...');
		createWindow();
	} catch (error) {
		console.error('Error creating window:', error);
	}
});

// 添加更多调试信息
app.on('ready', () => {
	console.log('App ready event fired');
});

process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// 处理文件选择
ipcMain.handle('select-file', async () => {
	const result = await dialog.showOpenDialog({
		properties: ['openFile'],
		filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
	});

	if (!result.canceled && result.filePaths.length > 0) {
		return result.filePaths[0];
	}
	return null;
});

// 处理Excel文件读取
ipcMain.handle('read-excel', async (event, filePath: string) => {
	try {
		// 读取Excel文件时获取工作表范围
		const workbook = XLSX.readFile(filePath);
		const sheetNames = workbook.SheetNames;
		const excelData = sheetNames.map((sheetName) => {
			const worksheet = workbook.Sheets[sheetName];
			// 获取工作表范围（如!ref: A1:Z100）
			const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
			// 计算实际列数（包含空列）
			const columnCount = range.e.c + 1; // 列索引从0开始
			// 修改：使用header: "A"选项获取列字母作为键
			const data = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
			// 移除第一行（表头行），保留数据行
			const headerRow = data.shift();
			return {
				name: sheetName,
				data,
				columnCount, // 添加实际列数信息
				headerRow, // 保留表头行供参考
			};
		});
		// console.log(excelData, 'excelData');

		return excelData;
	} catch (error) {
		console.error('Error reading Excel file:', error);
		throw error;
	}
});

// 处理结果导出
ipcMain.handle(
	'export-results',
	async (event, data: any[], filePath: string) => {
		try {
			const worksheet = XLSX.utils.json_to_sheet(data);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, '异常分析结果');
			XLSX.writeFile(workbook, filePath);
			return true;
		} catch (error) {
			console.error('Error exporting results:', error);
			throw error;
		}
	}
);

// 处理图片选择
ipcMain.handle('select-images', async () => {
	const result = await dialog.showOpenDialog({
		properties: ['openFile', 'multiSelections'],
		filters: [
			{ 
				name: 'Image Files', 
				extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] 
			}
		],
	});

	if (!result.canceled && result.filePaths.length > 0) {
		return result.filePaths;
	}
	return null;
});

// OCR工作器缓存和管理
let ocrWorker: any = null;
let ocrWorkerInitializing = false;
let workerCreationTime = 0;
const WORKER_TIMEOUT = 30000; // 30秒超时
const WORKER_MAX_IDLE_TIME = 10 * 60 * 1000; // 10分钟空闲时间
let lastWorkerUsage = 0;

// 工作器健康检查
setInterval(() => {
	if (ocrWorker && Date.now() - lastWorkerUsage > WORKER_MAX_IDLE_TIME) {
		console.log('OCR worker idle timeout, terminating...');
		cleanupOCRResources();
	}
}, 60000); // 每分钟检查一次

// 初始化OCR工作器（优化版本）
async function initOCRWorker() {
	if (ocrWorker) {
		lastWorkerUsage = Date.now();
		return ocrWorker;
	}

	if (ocrWorkerInitializing) {
		// 等待正在进行的初始化
		while (ocrWorkerInitializing && Date.now() - workerCreationTime < WORKER_TIMEOUT) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		if (ocrWorker) {
			lastWorkerUsage = Date.now();
			return ocrWorker;
		}
	}

	ocrWorkerInitializing = true;
	workerCreationTime = Date.now();

	try {
		console.log('Initializing OCR worker with optimized settings...');
		
		// 创建工作器，支持中英文
		ocrWorker = await createWorker(['eng', 'chi_sim'], 1, {
			logger: m => {
				if (m.status === 'recognizing text') {
					console.log(`OCR: ${m.status} - ${(m.progress * 100).toFixed(1)}%`);
				}
			},
			errorHandler: (error: Error) => {
				console.error('OCR Worker error:', error);
			}
		});

		// 设置OCR参数优化
		await ocrWorker.setParameters({
			tessedit_pageseg_mode: '6', // 假设一个统一的文本块
			tessedit_ocr_engine_mode: '1', // 使用神经网络LSTM引擎
			preserve_interword_spaces: '1', // 保留单词间空格
			tessedit_char_whitelist: '', // 不限制字符
		});
		
		console.log('OCR Worker initialized successfully with optimizations');
		lastWorkerUsage = Date.now();
		return ocrWorker;
	} catch (error) {
		console.error('Failed to initialize OCR worker:', error);
		ocrWorker = null;
		throw new Error(`OCR引擎初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
	} finally {
		ocrWorkerInitializing = false;
	}
}

// 增强的图片预处理函数（处理ArrayBuffer数据）
async function preprocessImageData(imageData: ArrayBuffer, fileName: string): Promise<string> {
	try {
		// 检查数据有效性
		if (!imageData || imageData.byteLength === 0) {
			throw new Error('图片数据为空');
		}

		// 文件大小检查
		const fileSizeInMB = imageData.byteLength / (1024 * 1024);
		
		if (fileSizeInMB > 50) {
			throw new Error(`图片文件过大 (${fileSizeInMB.toFixed(2)}MB)，请使用小于50MB的图片`);
		}
		
		if (fileSizeInMB > 10) {
			console.warn(`Large image file: ${fileSizeInMB.toFixed(2)}MB, processing may be slow`);
		}

		// 检查文件格式
		const ext = path.extname(fileName).toLowerCase();
		const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
		
		if (!supportedFormats.includes(ext)) {
			throw new Error(`不支持的图片格式: ${ext}`);
		}

		// 创建临时文件
		const tempDir = path.join(__dirname, 'temp');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
		
		const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
		const tempFilePath = path.join(tempDir, tempFileName);
		
		// 将ArrayBuffer写入临时文件
		const buffer = Buffer.from(imageData);
		fs.writeFileSync(tempFilePath, buffer);
		
		// 验证写入的文件
		if (!fs.existsSync(tempFilePath)) {
			throw new Error('创建临时图片文件失败');
		}
		
		const stats = fs.statSync(tempFilePath);
		if (stats.size === 0) {
			throw new Error('临时图片文件为空');
		}

		console.log(`Created temp image file: ${tempFilePath} (${fileSizeInMB.toFixed(2)}MB)`);
		return tempFilePath;
	} catch (error) {
		console.error('Error preprocessing image data:', error);
		throw error;
	}
}

// 清理临时文件
function cleanupTempFile(filePath: string) {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Cleaned up temp file: ${filePath}`);
		}
	} catch (error) {
		console.error('Error cleaning up temp file:', error);
	}
}

// 处理OCR识别（优化版本）
ipcMain.handle('recognize-image', async (event, imageData: ArrayBuffer, fileName: string, options: any = {}) => {
	const startTime = Date.now();
	console.log('OCR recognition requested for:', fileName);
	
	const maxRetries = 3;
	let lastError: Error | null = null;
	let attempt = 0;

	// 输入验证
	if (!imageData || !(imageData instanceof ArrayBuffer)) {
		throw new Error('无效的图片数据');
	}
	
	if (!fileName || typeof fileName !== 'string') {
		throw new Error('无效的文件名');
	}

	let tempFilePath: string | null = null;
	
	for (attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(`OCR attempt ${attempt}/${maxRetries} for: ${fileName}`);
			
			// 预处理图片数据（创建临时文件）
			tempFilePath = await preprocessImageData(imageData, fileName);
			
			// 初始化OCR工作器（延迟初始化）
			const worker = await initOCRWorker();
			
			// 发送开始识别的进度更新
			event.sender.send('ocr-progress', { 
				imagePath: fileName, 
				progress: 10, 
				status: 'starting' 
			});

			// 设置识别超时
			const recognitionPromise = worker.recognize(tempFilePath, {
				rectangles: options.rectangles || undefined,
				...options
			});

			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('OCR识别超时')), 60000); // 60秒超时
			});

			// 执行OCR识别（带超时）
			const { data } = await Promise.race([recognitionPromise, timeoutPromise]) as any;

			// 验证识别结果
			if (!data) {
				throw new Error('OCR引擎返回空结果');
			}

			// 发送完成的进度更新
			event.sender.send('ocr-progress', { 
				imagePath: fileName, 
				progress: 100, 
				status: 'completed' 
			});

			// 智能文本清理
			let cleanText = data.text || '';
			
			if (cleanText) {
				cleanText = cleanText
					.replace(/\s+/g, ' ')  // 将多个空白字符替换为单个空格
					.replace(/^\s+|\s+$/g, '')  // 去除首尾空白
					.replace(/\n\s*\n/g, '\n')  // 去除多余的空行
					.replace(/[^\S\n]+/g, ' ') // 清理除换行外的其他空白字符
					.replace(/(.)\1{4,}/g, '$1$1$1'); // 减少重复字符（超过4个的减少到3个）
			}

			// 计算置信度（处理异常值）
			let confidence = (data.confidence || 0) / 100;
			confidence = Math.max(0, Math.min(1, confidence)); // 确保在0-1范围内

			const processingTime = Date.now() - startTime;
			
			const result = {
				text: cleanText,
				confidence,
				words: data.words?.length || 0,
				lines: data.lines?.length || 0,
				paragraphs: data.paragraphs?.length || 0,
				processingTime
			};

			console.log(`OCR completed successfully on attempt ${attempt}:`, {
				textLength: result.text.length,
				confidence: (result.confidence * 100).toFixed(1) + '%',
				words: result.words,
				processingTime: processingTime + 'ms'
			});

			// 记录使用时间
			lastWorkerUsage = Date.now();

			// 清理临时文件
			if (tempFilePath) {
				cleanupTempFile(tempFilePath);
				tempFilePath = null;
			}

			return result;

		} catch (error) {
			lastError = error as Error;
			const errorMsg = lastError.message || '未知错误';
			
			console.error(`OCR attempt ${attempt} failed:`, errorMsg);
			
			// 发送错误的进度更新
			event.sender.send('ocr-progress', { 
				imagePath: fileName, 
				progress: 0, 
				status: 'error',
				error: errorMsg
			});

			// 清理当前尝试的临时文件
			if (tempFilePath) {
				cleanupTempFile(tempFilePath);
				tempFilePath = null;
			}

			// 错误分类和处理策略
			const isRetryableError = 
				errorMsg.includes('timeout') ||
				errorMsg.includes('网络') ||
				errorMsg.includes('临时') ||
				errorMsg.includes('busy') ||
				errorMsg.includes('memory');

			// 对于不可重试的错误，直接抛出
			if (!isRetryableError && attempt === 1) {
				if (errorMsg.includes('不存在') || errorMsg.includes('损坏') || errorMsg.includes('格式')) {
					throw new Error(`图片文件问题: ${errorMsg}`);
				}
				if (errorMsg.includes('过大')) {
					throw new Error(`文件过大: ${errorMsg}`);
				}
			}

			// 如果不是最后一次尝试，等待一段时间后重试
			if (attempt < maxRetries && isRetryableError) {
				// 指数退避，但限制最大延迟
				const delay = Math.min(Math.pow(2, attempt) * 1000, 5000);
				console.log(`Retrying in ${delay}ms... (${maxRetries - attempt} attempts remaining)`);
				await new Promise(resolve => setTimeout(resolve, delay));
				
				// 如果是内存或工作器相关错误，重置工作器
				if (errorMsg.includes('memory') || errorMsg.includes('worker')) {
					console.log('Resetting OCR worker due to error...');
					await cleanupOCRResources();
				}
			}
		}
	}

	// 所有重试都失败了
	const totalTime = Date.now() - startTime;
	const finalErrorMessage = `OCR识别失败 (${attempt}次尝试，耗时${totalTime}ms): ${lastError?.message || '未知错误'}`;
	
	console.error(finalErrorMessage);
	
	// 最终清理临时文件
	if (tempFilePath) {
		cleanupTempFile(tempFilePath);
	}
	
	throw new Error(finalErrorMessage);
});

// 注意：批量OCR识别已通过渲染进程中的循环调用单张识别来实现
// 这里保留这个处理器是为了向后兼容，但推荐使用渲染进程中的批量处理逻辑

// 处理OCR结果导出
ipcMain.handle('export-ocr-excel', async (event, data: any[], images: any[]) => {
	try {
		// 发送导出开始进度
		event.sender.send('export-progress', { 
			progress: 0, 
			status: 'starting',
			message: '准备导出...' 
		});

		const result = await dialog.showSaveDialog({
			defaultPath: `OCR识别结果_${new Date().toISOString().slice(0, 10)}.xlsx`,
			filters: [
				{ name: 'Excel Files', extensions: ['xlsx'] }
			],
		});

		if (!result.canceled && result.filePath) {
			// 创建工作簿
			const workbook = XLSX.utils.book_new();
			
			// 准备Excel数据
			const excelData: any[] = [];
			const processedImages: any[] = [];
			
			// 发送进度更新
			event.sender.send('export-progress', { 
				progress: 10, 
				status: 'processing',
				message: '处理图片数据...' 
			});

			// 处理每张图片
			for (let i = 0; i < images.length; i++) {
				const image = images[i];
				
				try {
					// 获取图片路径
					const imagePath = image.file.path || image.url;
					let fileSizeKB = 0;
					let imageInfo = null;
					
					// 如果有图片路径，获取图片信息
					if (imagePath && fs.existsSync(imagePath)) {
						try {
							const stats = fs.statSync(imagePath);
							fileSizeKB = Math.round(stats.size / 1024);
							
							// 检查图片是否过大
							if (isImageTooLarge(imagePath, 5)) { // 限制5MB
								console.warn(`Large image file: ${image.file.name} (${formatFileSize(stats.size)})`);
							}
							
							// 生成图片缩略图信息
							imageInfo = generateImageThumbnailInfo(imagePath);
							
							// 处理图片为base64（用于可能的图片嵌入）
							const processedImage = await processImageToBase64(imagePath, {
								maxWidth: 200,
								maxHeight: 150,
								quality: 0.7
							});
							
							processedImages.push({
								row: i + 2, // Excel行号从1开始，加上表头行
								...processedImage,
								name: image.file.name,
								originalPath: imagePath
							});
							
						} catch (imageError) {
							console.error(`Error processing image ${image.file.name}:`, imageError);
							imageInfo = {
								name: image.file.name,
								size: '未知',
								type: '未知',
								path: imagePath
							};
						}
					} else if (image.file.size) {
						fileSizeKB = Math.round(image.file.size / 1024);
					}
					
					// 计算置信度
					const confidence = image.confidence ? `${(image.confidence * 100).toFixed(1)}%` : '未知';
					
					// 添加基础数据行
					const rowData = {
						'序号': i + 1,
						'文件名': image.file.name,
						'文件大小(KB)': fileSizeKB || '未知',
						'图片类型': imageInfo?.type || '未知',
						'识别状态': getStatusText(image.status),
						'置信度': confidence,
						'识别文字': image.text || '暂无识别结果',
						'错误信息': image.error || '',
						'图片路径': imageInfo?.path || '无'
					};
					
					excelData.push(rowData);
					
					// 更新进度
					const progress = 10 + Math.round((i / images.length) * 50);
					event.sender.send('export-progress', { 
						progress, 
						status: 'processing',
						message: `处理图片 ${i + 1}/${images.length}...` 
					});
					
				} catch (error) {
					console.error(`Error processing image ${i}:`, error);
					// 即使单张图片失败，也继续处理其他图片
					excelData.push({
						'序号': i + 1,
						'文件名': image.file.name,
						'文件大小(KB)': '未知',
						'图片类型': '未知',
						'识别状态': '处理失败',
						'置信度': '未知',
						'识别文字': image.text || '暂无识别结果',
						'错误信息': error instanceof Error ? error.message : '处理图片时发生错误',
						'图片路径': '无'
					});
				}
			}

			// 发送进度更新
			event.sender.send('export-progress', { 
				progress: 60, 
				status: 'processing',
				message: '创建Excel工作表...' 
			});

			// 创建工作表
			const worksheet = XLSX.utils.json_to_sheet(excelData);
			
			// 设置列宽
			const columnWidths = [
				{ wch: 8 },   // 序号
				{ wch: 25 },  // 文件名
				{ wch: 15 },  // 文件大小
				{ wch: 15 },  // 图片类型
				{ wch: 12 },  // 识别状态
				{ wch: 12 },  // 置信度
				{ wch: 50 },  // 识别文字
				{ wch: 30 },  // 错误信息
				{ wch: 40 }   // 图片路径
			];
			worksheet['!cols'] = columnWidths;

			// 设置行高（为更好的可读性）
			const rowHeights = [];
			for (let i = 0; i <= excelData.length; i++) {
				rowHeights.push({ hpt: i === 0 ? 30 : 60 }); // 表头30像素，数据行60像素
			}
			worksheet['!rows'] = rowHeights;

			// 发送进度更新
			event.sender.send('export-progress', { 
				progress: 75, 
				status: 'processing',
				message: '优化表格样式...' 
			});

			// 添加图片信息到工作表（由于xlsx库限制，添加图片说明而非实际图片）
			if (processedImages.length > 0) {
				// 创建图片信息工作表
				const imageInfoData = processedImages.map((imgData, index) => ({
					'序号': index + 1,
					'文件名': imgData.name,
					'原始大小': formatFileSize(imgData.originalSize),
					'压缩后大小': formatFileSize(imgData.compressedSize),
					'MIME类型': imgData.mimeType,
					'预计尺寸': `${imgData.dimensions.width}x${imgData.dimensions.height}`,
					'文件路径': imgData.originalPath,
					'处理状态': '已处理'
				}));

				const imageInfoWorksheet = XLSX.utils.json_to_sheet(imageInfoData);
				imageInfoWorksheet['!cols'] = [
					{ wch: 8 },   // 序号
					{ wch: 25 },  // 文件名
					{ wch: 15 },  // 原始大小
					{ wch: 15 },  // 压缩后大小
					{ wch: 15 },  // MIME类型
					{ wch: 15 },  // 预计尺寸
					{ wch: 40 },  // 文件路径
					{ wch: 12 }   // 处理状态
				];
				
				XLSX.utils.book_append_sheet(workbook, imageInfoWorksheet, '图片信息');
			}

			// 发送进度更新
			event.sender.send('export-progress', { 
				progress: 85, 
				status: 'processing',
				message: '生成统计信息...' 
			});

			// 添加工作表到工作簿
			XLSX.utils.book_append_sheet(workbook, worksheet, 'OCR识别结果');
			
			// 添加统计信息工作表
			const completedCount = images.filter(img => img.status === 'completed').length;
			const errorCount = images.filter(img => img.status === 'error').length;
			const pendingCount = images.filter(img => img.status === 'pending').length;
			const processingCount = images.filter(img => img.status === 'processing').length;
			
			const statsData = [
				{ '项目': '总图片数量', '数值': images.length, '百分比': '100%' },
				{ '项目': '识别成功', '数值': completedCount, '百分比': `${((completedCount / images.length) * 100).toFixed(1)}%` },
				{ '项目': '识别失败', '数值': errorCount, '百分比': `${((errorCount / images.length) * 100).toFixed(1)}%` },
				{ '项目': '识别中', '数值': processingCount, '百分比': `${((processingCount / images.length) * 100).toFixed(1)}%` },
				{ '项目': '待识别', '数值': pendingCount, '百分比': `${((pendingCount / images.length) * 100).toFixed(1)}%` },
				{ '项目': '平均置信度', '数值': calculateAverageConfidence(images), '百分比': '-' },
				{ '项目': '总图片大小', '数值': calculateTotalImageSize(images), '百分比': '-' },
				{ '项目': '导出时间', '数值': new Date().toLocaleString('zh-CN'), '百分比': '-' },
				{ '项目': '导出文件', '数值': path.basename(result.filePath), '百分比': '-' }
			];
			
			const statsWorksheet = XLSX.utils.json_to_sheet(statsData);
			statsWorksheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }];
			XLSX.utils.book_append_sheet(workbook, statsWorksheet, '统计信息');

			// 发送进度更新
			event.sender.send('export-progress', { 
				progress: 95, 
				status: 'processing',
				message: '保存Excel文件...' 
			});

			// 写入文件
			XLSX.writeFile(workbook, result.filePath);
			
			// 发送完成进度
			event.sender.send('export-progress', { 
				progress: 100, 
				status: 'completed',
				message: `导出完成！文件已保存至: ${path.basename(result.filePath)}` 
			});
			
			return true;
		}
		return false;
	} catch (error) {
		console.error('Error exporting OCR results:', error);
		
		// 发送错误进度
		event.sender.send('export-progress', { 
			progress: 0, 
			status: 'error',
			message: `导出失败: ${error instanceof Error ? error.message : '未知错误'}` 
		});
		
		throw error;
	}
});

// 获取状态文本
function getStatusText(status: string): string {
	const statusMap: { [key: string]: string } = {
		pending: '待识别',
		processing: '识别中',
		completed: '已完成',
		error: '识别失败'
	};
	return statusMap[status] || status;
}

// 计算平均置信度
function calculateAverageConfidence(images: any[]): string {
	const completedImages = images.filter(img => 
		img.status === 'completed' && 
		typeof img.confidence === 'number'
	);
	
	if (completedImages.length === 0) {
		return '无数据';
	}
	
	const totalConfidence = completedImages.reduce((sum, img) => sum + img.confidence, 0);
	const average = (totalConfidence / completedImages.length * 100).toFixed(1);
	return `${average}%`;
}

// 计算总图片大小
function calculateTotalImageSize(images: any[]): string {
	let totalSize = 0;
	
	images.forEach(image => {
		if (image.file && image.file.size) {
			totalSize += image.file.size;
		} else if (image.url) {
			try {
				const stats = fs.statSync(image.url);
				totalSize += stats.size;
			} catch (error) {
				// 忽略无法访问的文件
			}
		}
	});
	
	return formatFileSize(totalSize);
}

// 清理OCR资源
async function cleanupOCRResources() {
	if (ocrWorker) {
		try {
			console.log('Cleaning up OCR worker...');
			await ocrWorker.terminate();
			ocrWorker = null;
			console.log('OCR worker terminated successfully');
		} catch (error) {
			console.error('Error terminating OCR worker:', error);
		}
	}
}

// 清理临时文件夹
function cleanupTempDirectory() {
	try {
		const tempDir = path.join(__dirname, 'temp');
		if (fs.existsSync(tempDir)) {
			const files = fs.readdirSync(tempDir);
			files.forEach(file => {
				const filePath = path.join(tempDir, file);
				try {
					fs.unlinkSync(filePath);
				} catch (error) {
					console.error(`Error deleting temp file ${filePath}:`, error);
				}
			});
			console.log(`Cleaned up ${files.length} temporary files`);
		}
	} catch (error) {
		console.error('Error cleaning up temp directory:', error);
	}
}

// 应用退出时清理资源
app.on('before-quit', async () => {
	await cleanupOCRResources();
	cleanupTempDirectory();
});

// 处理OCR工作器重置
ipcMain.handle('reset-ocr-worker', async () => {
	try {
		await cleanupOCRResources();
		cleanupTempDirectory();
		console.log('OCR worker reset successfully');
		return true;
	} catch (error) {
		console.error('Error resetting OCR worker:', error);
		throw error;
	}
});