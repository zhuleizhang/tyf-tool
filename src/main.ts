const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';
import * as ExcelJS from 'exceljs';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import { formatFileSize } from './utils/imageProcessor';
import { excelImageDebugger } from './utils/excelImageDebugger';
import { OCR_SUPPORTED_FORMATS } from './constants';

// - macOS: ~/Library/Application Support/[应用名称]/
// - Windows: C:\Users\[用户名]\AppData\Roaming\[应用名称]\
// - Linux: ~/.config/[应用名称]/
// 创建自定义日志函数
const logToFile = (...logData: any[]) => {
	try {
		// 获取应用的用户数据目录（跨平台标准路径）
		const userDataPath = app.getPath('userData');

		// 创建logs子目录
		const logsDir = path.join(userDataPath, 'logs');
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
		}

		// 生成日志文件名（包含日期）
		const date = new Date();
		const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1)
			.toString()
			.padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
		const logFile = path.join(logsDir, `app-${dateStr}.log`);

		const logDataStringify = logData.reduce((prev, cur) => {
			return prev + JSON.stringify(cur) + '\n';
		}, '');

		// 写入日志
		fs.appendFileSync(
			logFile,
			`${date.toISOString()}: ${logDataStringify}\n`
		);
	} catch (error) {
		// 如果写日志本身出错，不应该影响应用运行
		console.error('写入日志文件失败:', error);
	}
};

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
	logToFile('Creating main window...');
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
	logToFile('Loading HTML from:', htmlPath);
	mainWindow.loadFile(htmlPath);

	if (process.env.NODE_ENV === 'development') {
		// mainWindow.webContents.openDevTools();
	}

	// 添加错误处理
	mainWindow.webContents.on(
		'did-fail-load',
		(event, errorCode, errorDescription) => {
			logToFile('Failed to load:', errorCode, errorDescription);
		}
	);

	mainWindow.webContents.on('dom-ready', () => {
		console.log('DOM ready');
		logToFile('DOM ready');
	});

	// // 添加此行强制打开开发者工具
	// mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
	try {
		logToFile('App is ready, creating window...');
		createWindow();

		// 记录应用启动信息
		logToFile('===== 应用启动 =====');
		logToFile(`应用版本: ${app.getVersion()}`);
		logToFile(`操作系统: ${process.platform} ${process.arch}`);
		logToFile(`Node版本: ${process.versions.node}`);
		logToFile(`Electron版本: ${process.versions.electron}`);
	} catch (error) {
		logToFile(`创建窗口失败: ${error}`);
	}
});

// 添加更多调试信息
app.on('ready', () => {
	console.log('App ready event fired');
});

process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	logToFile(`未捕获的异常: ${error}`);
	logToFile(`错误堆栈: ${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	logToFile(`未处理的Promise拒绝: ${reason}`);
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
		logToFile('Error reading Excel file:', error);
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
			logToFile('Error exporting results:', error);
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
				extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
			},
		],
	});

	if (!result.canceled && result.filePaths.length > 0) {
		return result.filePaths;
	}
	return null;
});

// OCR工作器缓存和管理
let ocrWorker: Tesseract.Worker | null = null;
let ocrWorkerInitializing = false;
let workerCreationTime = 0;
let currentWorkerLanguage: string = '';
const WORKER_TIMEOUT = 30000; // 30秒超时
const WORKER_MAX_IDLE_TIME = 10 * 60 * 1000; // 10分钟空闲时间
let lastWorkerUsage = 0;

// 工作器健康检查
setInterval(() => {
	if (ocrWorker && Date.now() - lastWorkerUsage > WORKER_MAX_IDLE_TIME) {
		logToFile('OCR worker idle timeout, terminating...');
		cleanupOCRResources();
	}
}, 60000); // 每分钟检查一次

// 初始化OCR工作器（支持动态语言选择）
async function initOCRWorker(language: string = 'chi_sim') {
	// 如果当前工作器存在且语言匹配，直接返回
	if (ocrWorker && currentWorkerLanguage === language) {
		lastWorkerUsage = Date.now();
		return ocrWorker;
	}

	// 如果语言不匹配，清理当前工作器
	if (ocrWorker && currentWorkerLanguage !== language) {
		logToFile(
			`Language changed from ${currentWorkerLanguage} to ${language}, recreating worker...`
		);
		await cleanupOCRResources();
	}

	if (ocrWorkerInitializing) {
		// 等待正在进行的初始化
		while (
			ocrWorkerInitializing &&
			Date.now() - workerCreationTime < WORKER_TIMEOUT
		) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		if (ocrWorker) {
			lastWorkerUsage = Date.now();
			return ocrWorker;
		}
	}

	ocrWorkerInitializing = true;
	workerCreationTime = Date.now();

	try {
		logToFile(`Initializing OCR worker for language: ${language}...`);

		// 根据选择的语言加载相应模型
		const languages = language.includes('+')
			? language.split('+')
			: [language];
		logToFile(`Loading languages: ${languages.join(', ')}`);

		ocrWorker = await createWorker(languages, 3, {
			langPath: path.join(__dirname, 'assets'),
			gzip: false,
			logger: (m) => {
				if (m.status === 'recognizing text') {
					logToFile(
						`OCR: ${m.status} - ${(m.progress * 100).toFixed(1)}%`
					);
				} else {
					logToFile(`OCR log: ${JSON.stringify(m)}`);
				}
			},
			errorHandler: (error: Error) => {
				logToFile('OCR Worker error:', error);
			},
		});

		// 根据语言设置优化参数
		const parameters = getOCRParameters(language);
		await ocrWorker.setParameters(parameters);

		logToFile(`OCR Worker initialized successfully for ${language}`);
		currentWorkerLanguage = language;
		lastWorkerUsage = Date.now();
		return ocrWorker;
	} catch (error) {
		logToFile('Failed to initialize OCR worker:', error);
		ocrWorker = null;
		throw new Error(
			`OCR引擎初始化失败: ${
				error instanceof Error ? error.message : '未知错误'
			}`
		);
	} finally {
		ocrWorkerInitializing = false;
	}
}

// 根据语言获取优化的OCR参数
function getOCRParameters(language: string): any {
	const baseParameters = {
		tessedit_pageseg_mode: '6', // 假设一个统一的文本块
		tessedit_ocr_engine_mode: '1', // 使用神经网络LSTM引擎
		preserve_interword_spaces: '1', // 保留单词间空格
		tessedit_char_whitelist: '', // 不限制字符
	};

	if (language === 'chi_sim') {
		// 中文专用优化参数
		return {
			...baseParameters,
			// 中文识别专用参数
			tessedit_enable_doc_dict: '0', // 禁用文档字典，避免英文干扰
			tessedit_enable_bigram_correction: '1', // 启用双字符校正，提高中文准确率
			tessedit_enable_dict_correction: '0', // 禁用字典校正，避免中文被错误校正为英文
			classify_enable_learning: '0', // 禁用学习模式，专注识别
			// 提高中文识别质量的参数
			textord_heavy_nr: '1', // 启用重噪声处理
			textord_noise_rejwords: '1', // 启用噪声词汇拒绝
			textord_noise_rejrows: '1', // 启用噪声行拒绝
		};
	} else if (language === 'eng') {
		// 英文专用优化参数
		return {
			...baseParameters,
			tessedit_enable_doc_dict: '1', // 启用文档字典，提高英文准确率
			tessedit_enable_bigram_correction: '1', // 启用双字符校正
			tessedit_enable_dict_correction: '1', // 启用字典校正
			classify_enable_learning: '1', // 启用学习模式
		};
	} else {
		// 混合语言或其他语言的平衡参数
		return {
			...baseParameters,
			tessedit_enable_doc_dict: '0', // 禁用文档字典，避免语言间干扰
			tessedit_enable_bigram_correction: '1', // 启用双字符校正
			tessedit_enable_dict_correction: '0', // 禁用字典校正，避免误校正
			classify_enable_learning: '0', // 禁用学习模式
		};
	}
}

// 根据语言清理文本
function cleanTextByLanguage(text: string, language: string): string {
	if (!text) return '';

	if (language === 'chi_sim') {
		// 中文专用文本清理
		return text;
		// // 保留中文字符之间的自然间距
		// .replace(
		// 	/([^\u4e00-\u9fa5\s])\s+([^\u4e00-\u9fa5\s])/g,
		// 	'$1 $2'
		// ) // 保留非中文字符间的空格
		// .replace(/\s+/g, ' ') // 将多个空白字符替换为单个空格
		// .replace(/^\s+|\s+$/g, '') // 去除首尾空白
		// .replace(/\n\s*\n/g, '\n') // 去除多余的空行
		// // 中文特殊处理：去除中文字符间的多余空格
		// .replace(/([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, '$1 $2') // 保留英文数字间空格
		// .replace(/([a-zA-Z0-9])\s+([\u4e00-\u9fa5])/g, '$1$2') // 去除英文数字与中文间空格
		// .replace(/([\u4e00-\u9fa5])\s+([a-zA-Z0-9])/g, '$1$2') // 去除中文与英文数字间空格
		// .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2') // 去除中文字符间空格
		// .replace(/(.)\1{4,}/g, '$1$1$1') // 减少重复字符（超过4个的减少到3个）
	} else if (language === 'eng') {
		// 英文专用文本清理
		return text
			.replace(/\s+/g, ' ') // 将多个空白字符替换为单个空格
			.replace(/^\s+|\s+$/g, '') // 去除首尾空白
			.replace(/\n\s*\n/g, '\n') // 去除多余的空行
			.replace(/([a-zA-Z])\s+([a-zA-Z])/g, '$1 $2') // 保持英文单词间的空格
			.replace(/(.)\1{4,}/g, '$1$1$1'); // 减少重复字符
	} else {
		// 混合语言的平衡清理
		return (
			text
				.replace(/\s+/g, ' ') // 将多个空白字符替换为单个空格
				.replace(/^\s+|\s+$/g, '') // 去除首尾空白
				.replace(/\n\s*\n/g, '\n') // 去除多余的空行
				// 保留英文单词间空格，去除中文字符间多余空格
				.replace(/([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, '$1 $2') // 保留英文数字间空格
				.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2') // 去除中文字符间空格
				.replace(/(.)\1{4,}/g, '$1$1$1')
		); // 减少重复字符
	}
}

// 增强的图片预处理函数（处理ArrayBuffer数据，针对中文OCR优化）
async function preprocessImageData(
	imageData: ArrayBuffer,
	fileName: string
): Promise<string> {
	try {
		// 检查数据有效性
		if (!imageData || imageData.byteLength === 0) {
			throw new Error('图片数据为空');
		}

		// 文件大小检查
		const fileSizeInMB = imageData.byteLength / (1024 * 1024);

		if (fileSizeInMB > 50) {
			throw new Error(
				`图片文件过大 (${fileSizeInMB.toFixed(
					2
				)}MB)，请使用小于50MB的图片`
			);
		}

		if (fileSizeInMB > 5) {
			console.warn(
				`较大的图片文件: ${fileSizeInMB.toFixed(
					2
				)}MB，建议压缩后再识别以提高速度`
			);
		}

		// 检查文件格式
		const ext = path.extname(fileName).toLowerCase();
		if (!OCR_SUPPORTED_FORMATS.includes(ext)) {
			throw new Error(`不支持的图片格式: ${ext}`);
		}

		// 创建临时文件 - 修改为使用系统临时目录
		const tempDir = path.join(app.getPath('temp'), 'tyf-tool', 'temp');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		const tempFileName = `chinese_ocr_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}${ext}`;
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

		logToFile(
			`创建中文OCR临时文件: ${tempFilePath} (${fileSizeInMB.toFixed(
				2
			)}MB)`
		);

		// 如果是PNG格式，直接返回（PNG对中文识别效果最好）
		if (ext === '.png') {
			return tempFilePath;
		}

		// 对于其他格式，可以考虑转换为PNG以提高中文识别率
		// 这里暂时直接返回原文件，后续可以添加图片格式转换逻辑
		return tempFilePath;
	} catch (error) {
		logToFile('Error preprocessing image data:', error);
		throw error;
	}
}

// 清理临时文件
function cleanupTempFile(filePath: string) {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			logToFile(`Cleaned up temp file: ${filePath}`);
		}
	} catch (error) {
		logToFile(`Error cleaning up temp file: ${JSON.stringify(error)}`);
	}
}

// 处理OCR识别（支持动态语言选择）
ipcMain.handle(
	'recognize-image',
	async (
		event,
		imageData: ArrayBuffer,
		fileName: string,
		options: any = {}
	) => {
		const startTime = Date.now();
		const language = options.language || 'chi_sim';
		logToFile(
			`OCR recognition requested for: ${fileName} (Language: ${language})`
		);

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
				logToFile(
					`OCR attempt ${attempt}/${maxRetries} for: ${fileName}`
				);

				// 预处理图片数据（创建临时文件）
				tempFilePath = await preprocessImageData(imageData, fileName);

				// 初始化OCR工作器（支持动态语言选择）
				const worker = await initOCRWorker(language);

				// 发送开始识别的进度更新
				event.sender.send('ocr-progress', {
					imagePath: fileName,
					progress: 10,
					status: 'starting',
				});
				logToFile(fileName, options, `${fileName} ocrOptions`);

				// 设置识别超时
				const recognitionPromise = worker.recognize(tempFilePath, {
					rectangles: options.rectangles || undefined,
					...options,
				});

				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(
						() => reject(new Error('中文OCR识别超时')),
						90000
					); // 90秒超时，给中文识别更多时间
				});

				// 执行OCR识别（带超时）
				const { data } = (await Promise.race([
					recognitionPromise,
					timeoutPromise,
				])) as any;

				// 验证识别结果
				if (!data) {
					throw new Error('OCR引擎返回空结果');
				}

				// 发送完成的进度更新
				event.sender.send('ocr-progress', {
					imagePath: fileName,
					progress: 100,
					status: 'completed',
				});

				// 根据语言进行智能文本清理
				let cleanText = data.text || '';
				cleanText = cleanTextByLanguage(cleanText, language);

				logToFile(`${JSON.stringify(data)} recognize data`);

				// 计算置信度（处理异常值）
				let confidence = (data.confidence || 0) / 100;
				confidence = Math.max(0, Math.min(1, confidence)); // 确保在0-1范围内

				const processingTime = Date.now() - startTime;
				logToFile(`${tempFilePath} ${fileName} tempFilePath`);

				const result = {
					text: cleanText,
					confidence,
					words: data.words?.length || 0,
					lines: data.lines?.length || 0,
					paragraphs: data.paragraphs?.length || 0,
					processingTime,
					rawText: data.text,
					tempFilePath,
				};

				logToFile(
					`OCR completed successfully on attempt ${attempt}: ${JSON.stringify(
						{
							textLength: result.text.length,
							confidence:
								(result.confidence * 100).toFixed(1) + '%',
							words: result.words,
							processingTime: processingTime + 'ms',
						}
					)}`
				);

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

				logToFile(`OCR attempt ${attempt} failed:`, errorMsg);

				// 发送错误的进度更新
				event.sender.send('ocr-progress', {
					imagePath: fileName,
					progress: 0,
					status: 'error',
					error: errorMsg,
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
					if (
						errorMsg.includes('不存在') ||
						errorMsg.includes('损坏') ||
						errorMsg.includes('格式')
					) {
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
					logToFile(
						`Retrying in ${delay}ms... (${
							maxRetries - attempt
						} attempts remaining)`
					);
					await new Promise((resolve) => setTimeout(resolve, delay));

					// 如果是内存或工作器相关错误，重置工作器
					if (
						errorMsg.includes('memory') ||
						errorMsg.includes('worker')
					) {
						logToFile('Resetting OCR worker due to error...');
						await cleanupOCRResources();
					}
				}
			}
		}

		// 所有重试都失败了
		const totalTime = Date.now() - startTime;
		const finalErrorMessage = `OCR识别失败 (${attempt}次尝试，耗时${totalTime}ms): ${
			lastError?.message || '未知错误'
		}`;

		logToFile(finalErrorMessage);

		// 最终清理临时文件
		if (tempFilePath) {
			cleanupTempFile(tempFilePath);
		}

		throw new Error(finalErrorMessage);
	}
);

// 注意：批量OCR识别已通过渲染进程中的循环调用单张识别来实现
// 这里保留这个处理器是为了向后兼容，但推荐使用渲染进程中的批量处理逻辑
// 处理图片数据传输（用于Excel嵌入）
ipcMain.handle(
	'get-image-buffer',
	async (event, imageUrl: string, fileName: string) => {
		try {
			// 如果是blob URL，无法在主进程中直接访问，返回null
			if (imageUrl.startsWith('blob:')) {
				console.warn(
					`Cannot access blob URL in main process: ${fileName}`
				);
				return null;
			}

			// 如果是文件路径，尝试读取
			if (fs.existsSync(imageUrl)) {
				const buffer = fs.readFileSync(imageUrl);
				return buffer;
			}

			console.warn(`Image file not found: ${imageUrl}`);
			return null;
		} catch (error) {
			logToFile(`Error reading image buffer for ${fileName}:`, error);
			return null;
		}
	}
);

// 处理OCR结果导出（支持图片嵌入）
// 处理OCR结果导出（支持图片嵌入）
ipcMain.handle(
	'export-ocr-excel',
	async (
		event,
		data: any[],
		images: any[],
		imageBuffers: { [key: string]: ArrayBuffer }
	) => {
		try {
			// 清空之前的调试信息
			excelImageDebugger.clear();

			// 输出调试信息
			logToFile(
				`Export OCR Excel called with: JSON.stringify(${{
					dataLength: data?.length || 0,
					imagesLength: images?.length || 0,
					imageBuffersKeys: imageBuffers
						? Object.keys(imageBuffers).length
						: 0,
					imageBufferSizes: imageBuffers
						? Object.entries(imageBuffers).map(([id, buffer]) => ({
								id,
								size: buffer?.byteLength || 0,
						  }))
						: [],
				}})`
			);

			// 发送导出开始进度
			event.sender.send('export-progress', {
				progress: 0,
				status: 'starting',
				message: '准备导出...',
			});

			const result = await dialog.showSaveDialog({
				defaultPath: `OCR识别结果_${new Date()
					.toISOString()
					.slice(0, 10)}.xlsx`,
				filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
			});

			if (!result.canceled && result.filePath) {
				// 使用ExcelJS创建工作簿，支持图片嵌入
				const workbook = new ExcelJS.Workbook();

				// 设置工作簿属性
				workbook.creator = 'OCR图片识别工具';
				workbook.lastModifiedBy = 'OCR图片识别工具';
				workbook.created = new Date();
				workbook.modified = new Date();

				// 发送进度更新
				event.sender.send('export-progress', {
					progress: 10,
					status: 'processing',
					message: '处理图片数据...',
				});

				// 创建主工作表
				const worksheet = workbook.addWorksheet('OCR识别结果', {
					pageSetup: {
						paperSize: 9,
						orientation: 'landscape',
						fitToPage: true,
						fitToWidth: 1,
						fitToHeight: 0,
					},
				});

				// 设置表头
				const headers = [
					'序号',
					'图片预览',
					'文件名',
					'文件大小',
					'识别状态',
					'置信度',
					'识别文字',
					'错误信息',
				];
				const headerRow = worksheet.addRow(headers);

				// 设置表头样式
				headerRow.eachCell((cell, colNumber) => {
					cell.font = { bold: true, color: { argb: 'FFFFFF' } };
					cell.fill = {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: '4472C4' },
					};
					cell.alignment = {
						vertical: 'middle',
						horizontal: 'center',
					};
					cell.border = {
						top: { style: 'thin' },
						left: { style: 'thin' },
						bottom: { style: 'thin' },
						right: { style: 'thin' },
					};
				});

				// 设置列宽
				worksheet.columns = [
					{ width: 8 }, // 序号
					{ width: 25 }, // 图片预览
					{ width: 25 }, // 文件名
					{ width: 15 }, // 文件大小
					{ width: 12 }, // 识别状态
					{ width: 12 }, // 置信度
					{ width: 50 }, // 识别文字
					{ width: 30 }, // 错误信息
				];

				// 处理每张图片并添加到Excel
				for (let i = 0; i < images.length; i++) {
					const image = images[i];

					try {
						// 计算文件大小
						let fileSizeKB = 0;
						if (image.file && image.file.size) {
							fileSizeKB = Math.round(image.file.size / 1024);
						}

						// 计算置信度
						const confidence = image.confidence
							? `${(image.confidence * 100).toFixed(1)}%`
							: '未知';

						// 添加数据行
						const dataRowFileName =
							image.file?.name || image.url || `image_${i + 1}`;
						const dataRow = worksheet.addRow([
							i + 1,
							'', // 图片预览列，稍后添加图片
							dataRowFileName,
							fileSizeKB > 1024
								? `${(fileSizeKB / 1024).toFixed(1)}MB`
								: `${fileSizeKB}KB`,
							getStatusText(image.status),
							confidence,
							image.text || '暂无识别结果',
							image.error || '',
						]);

						// 设置行高以适应图片
						dataRow.height = 120;

						// 设置数据行样式
						dataRow.eachCell((cell, colNumber) => {
							cell.alignment = {
								vertical: 'middle',
								horizontal: colNumber === 7 ? 'left' : 'center', // 识别文字左对齐
								wrapText: true,
							};
							cell.border = {
								top: { style: 'thin' },
								left: { style: 'thin' },
								bottom: { style: 'thin' },
								right: { style: 'thin' },
							};

							// 根据状态设置背景色
							if (colNumber === 5) {
								// 识别状态列
								switch (image.status) {
									case 'completed':
										cell.fill = {
											type: 'pattern',
											pattern: 'solid',
											fgColor: { argb: 'E8F5E8' },
										};
										break;
									case 'error':
										cell.fill = {
											type: 'pattern',
											pattern: 'solid',
											fgColor: { argb: 'FFEBEE' },
										};
										break;
									case 'processing':
										cell.fill = {
											type: 'pattern',
											pattern: 'solid',
											fgColor: { argb: 'FFF3E0' },
										};
										break;
								}
							}
						});

						// 尝试嵌入图片
						try {
							let imageBuffer: Buffer | null = null;
							let imageSource = '';

							// 优先级1：从传入的imageBuffers中获取
							if (imageBuffers && imageBuffers[image.id]) {
								const arrayBuffer = imageBuffers[image.id];
								if (arrayBuffer && arrayBuffer.byteLength > 0) {
									imageBuffer = Buffer.from(arrayBuffer);
									imageSource = 'provided buffer';
									const logFileName =
										image.file?.name ||
										image.url ||
										`image_${i + 1}`;
									logToFile(
										`📦 Using provided buffer for image: ${logFileName}, size: ${imageBuffer.length} bytes`
									);
								} else {
									const logFileName =
										image.file?.name ||
										image.url ||
										`image_${i + 1}`;
									logToFile(
										`⚠️ Invalid buffer for image: ${logFileName}, byteLength: ${
											arrayBuffer?.byteLength ||
											'undefined'
										}`
									);
								}
							} else {
								logToFile(
									`⚠️ No buffer found in imageBuffers for image ID: ${
										image.id
									}, available IDs: ${Object.keys(
										imageBuffers || {}
									).join(', ')}`
								);
							}

							// 优先级2：从文件路径读取
							if (!imageBuffer) {
								if (
									image.file &&
									image.file.path &&
									typeof image.file.path === 'string'
								) {
									try {
										if (fs.existsSync(image.file.path)) {
											imageBuffer = fs.readFileSync(
												image.file.path
											);
											imageSource = 'file path';
											logToFile(
												`📁 Read from file path: ${image.file.path}, size: ${imageBuffer?.length} bytes`
											);
										} else {
											logToFile(
												`⚠️ File path does not exist: ${image.file.path}`
											);
										}
									} catch (pathError) {
										logToFile(
											`❌ Error reading from file path ${
												image.file.path
											}: ${JSON.stringify(pathError)}`
										);
									}
								}
							}

							// 优先级3：从URL路径读取
							if (
								!imageBuffer &&
								typeof image.url === 'string' &&
								!image.url.startsWith('blob:')
							) {
								try {
									if (fs.existsSync(image.url)) {
										imageBuffer = fs.readFileSync(
											image.url
										);
										imageSource = 'URL path';
										logToFile(
											`🔗 Read from URL path: ${image.url}, size: ${imageBuffer?.length} bytes`
										);
									} else {
										logToFile(
											`⚠️ URL path does not exist: ${image.url}`
										);
									}
								} catch (urlError) {
									logToFile(
										`❌ Error reading from URL path ${image.url}:`,
										urlError
									);
								}
							}

							// 如果仍然没有获取到图片数据，输出详细的调试信息
							if (!imageBuffer) {
								const errorFileName =
									image.file?.name ||
									image.url ||
									`image_${i + 1}`;
								logToFile(
									`❌ Failed to get image buffer for: ${errorFileName}`
								);
								logToFile(`   - Image ID: ${image.id}`);
								logToFile(
									`   - File path: ${
										image.file?.path || 'undefined'
									}`
								);
								logToFile(
									`   - URL: ${image.url || 'undefined'}`
								);
								logToFile(
									`   - Available buffer IDs: ${Object.keys(
										imageBuffers || {}
									).join(', ')}`
								);
								logToFile(
									`   - Buffer exists: ${
										imageBuffers && imageBuffers[image.id]
											? 'yes'
											: 'no'
									}`
								);
								if (imageBuffers && imageBuffers[image.id]) {
									logToFile(
										`   - Buffer size: ${
											imageBuffers[image.id].byteLength
										} bytes`
									);
								}
							}

							// 验证图片数据并嵌入Excel
							if (imageBuffer && imageBuffer.length > 0) {
								try {
									// 获取文件名，确保不为undefined
									const fileName =
										image.file?.name ||
										image.url ||
										`image_${i + 1}`;
									logToFile(
										`📝 Processing image with fileName: ${fileName}`
									);

									// 验证图片数据的有效性
									const imageExtension =
										getImageExtension(fileName);

									// 验证图片数据是否为有效的图片格式
									const isValidImage = validateImageBuffer(
										imageBuffer,
										imageExtension
									);
									if (!isValidImage) {
										throw new Error('图片数据格式无效');
									}

									logToFile(
										`Adding image to workbook: ${fileName}, size: ${imageBuffer.length} bytes, extension: ${imageExtension}`
									);

									const imageId = workbook.addImage({
										buffer: imageBuffer,
										extension: imageExtension,
									});

									// 将图片添加到指定单元格 - 使用更精确的位置和尺寸控制
									const rowIndex = i + 2; // 数据行索引（第1行是表头）

									// 使用正确的ExcelJS图片定位方式
									worksheet.addImage(imageId, {
										tl: { col: 1.05, row: rowIndex - 0.95 }, // 稍微偏移避免边框重叠
										ext: { width: 140, height: 90 }, // 设置固定尺寸
										editAs: 'oneCell',
									});

									const successFileName =
										image.file?.name ||
										image.url ||
										`image_${i + 1}`;
									logToFile(
										`✅ Successfully embedded image: ${successFileName} at row ${rowIndex} (source: ${imageSource})`
									);

									// 记录成功的调试信息
									excelImageDebugger.logImageEmbed({
										imageId: image.id,
										fileName: successFileName,
										fileSize: image.file?.size || 0,
										bufferSize: imageBuffer.length,
										extension: imageExtension,
										isValidBuffer: true,
										embedSuccess: true,
										position: { row: i + 2, col: 2 },
									});
								} catch (embedError) {
									const errorMessage =
										embedError instanceof Error
											? embedError.message
											: '未知错误';
									const embedErrorFileName =
										image.file?.name ||
										image.url ||
										`image_${i + 1}`;
									logToFile(
										`❌ Error embedding image ${embedErrorFileName}:`,
										embedError
									);

									// 记录失败的调试信息
									const debugFileName =
										image.file?.name ||
										image.url ||
										`image_${i + 1}`;
									const debugExtension =
										getImageExtension(debugFileName);
									excelImageDebugger.logImageEmbed({
										imageId: image.id,
										fileName: debugFileName,
										fileSize: image.file?.size || 0,
										bufferSize: imageBuffer.length,
										extension: debugExtension,
										isValidBuffer: validateImageBuffer(
											imageBuffer,
											debugExtension
										),
										embedSuccess: false,
										embedError: errorMessage,
										position: { row: i + 2, col: 2 },
									});

									// 在单元格中显示具体错误信息
									const imageCell = worksheet.getCell(
										i + 2,
										2
									);
									imageCell.value = `嵌入失败: ${errorMessage}`;
									imageCell.font = {
										italic: true,
										color: { argb: 'FF0000' },
									};
									imageCell.alignment = {
										vertical: 'middle',
										horizontal: 'center',
									};
								}
							} else {
								// 详细的失败原因分析
								let failureReason = '未知原因';

								if (!imageBuffers || !imageBuffers[image.id]) {
									failureReason = '未提供图片数据';
								} else if (
									imageBuffers[image.id].byteLength === 0
								) {
									failureReason = '图片数据为空';
								} else if (!image.file) {
									failureReason = '文件对象无效';
								} else if (!image.file.name && !image.url) {
									failureReason = '文件名和URL均无效';
								} else if (!imageBuffer) {
									failureReason = '图片缓冲区创建失败';
								}

								// 记录失败的调试信息
								const failureFileName =
									image.file?.name ||
									image.url ||
									`image_${i + 1}`;
								excelImageDebugger.logImageEmbed({
									imageId: image.id,
									fileName: failureFileName,
									fileSize: image.file?.size || 0,
									bufferSize: 0,
									extension:
										getImageExtension(failureFileName),
									isValidBuffer: false,
									embedSuccess: false,
									embedError: failureReason,
									position: { row: i + 2, col: 2 },
								});

								// 在单元格中显示具体失败原因
								const imageCell = worksheet.getCell(i + 2, 2);
								imageCell.value = `无法嵌入: ${failureReason}`;
								imageCell.font = {
									italic: true,
									color: { argb: 'FF6600' },
								};
								imageCell.alignment = {
									vertical: 'middle',
									horizontal: 'center',
								};
								const warnFileName =
									image.file?.name ||
									image.url ||
									`image_${i + 1}`;
								console.warn(
									`⚠️ Cannot embed image ${warnFileName}: ${failureReason}`
								);
							}
						} catch (imageError) {
							const imageErrorFileName =
								image.file?.name ||
								image.url ||
								`image_${i + 1}`;
							logToFile(
								`Error processing image ${imageErrorFileName}:`,
								imageError
							);
							// 在单元格中显示错误信息
							const imageCell = worksheet.getCell(i + 2, 2);
							imageCell.value = `处理失败: ${
								imageError instanceof Error
									? imageError.message
									: '未知错误'
							}`;
							imageCell.font = {
								italic: true,
								color: { argb: 'FF0000' },
							};
						}

						// 更新进度
						const progress =
							10 + Math.round((i / images.length) * 60);
						event.sender.send('export-progress', {
							progress,
							status: 'processing',
							message: `处理图片 ${i + 1}/${images.length}...`,
						});
					} catch (error) {
						logToFile(`Error processing image ${i}:`, error);
						// 即使单张图片失败，也继续处理其他图片
						const errorRowFileName =
							image.file?.name || image.url || `image_${i + 1}`;
						const errorRow = worksheet.addRow([
							i + 1,
							'处理失败',
							errorRowFileName,
							'未知',
							'处理失败',
							'未知',
							image.text || '暂无识别结果',
							error instanceof Error
								? error.message
								: '处理图片时发生错误',
						]);

						errorRow.eachCell((cell) => {
							cell.fill = {
								type: 'pattern',
								pattern: 'solid',
								fgColor: { argb: 'FFEBEE' },
							};
							cell.alignment = {
								vertical: 'middle',
								horizontal: 'center',
							};
						});
					}
				}

				// 发送进度更新
				event.sender.send('export-progress', {
					progress: 75,
					status: 'processing',
					message: '生成统计信息...',
				});

				// 添加统计信息工作表
				const statsWorksheet = workbook.addWorksheet('统计信息');

				const completedCount = images.filter(
					(img) => img.status === 'completed'
				).length;
				const errorCount = images.filter(
					(img) => img.status === 'error'
				).length;
				const pendingCount = images.filter(
					(img) => img.status === 'pending'
				).length;
				const processingCount = images.filter(
					(img) => img.status === 'processing'
				).length;

				const statsData = [
					['项目', '数值', '百分比'],
					['总图片数量', images.length, '100%'],
					[
						'识别成功',
						completedCount,
						`${((completedCount / images.length) * 100).toFixed(
							1
						)}%`,
					],
					[
						'识别失败',
						errorCount,
						`${((errorCount / images.length) * 100).toFixed(1)}%`,
					],
					[
						'识别中',
						processingCount,
						`${((processingCount / images.length) * 100).toFixed(
							1
						)}%`,
					],
					[
						'待识别',
						pendingCount,
						`${((pendingCount / images.length) * 100).toFixed(1)}%`,
					],
					['平均置信度', calculateAverageConfidence(images), '-'],
					['总图片大小', calculateTotalImageSize(images), '-'],
					['导出时间', new Date().toLocaleString('zh-CN'), '-'],
					['导出文件', path.basename(result.filePath), '-'],
				];

				// 添加统计数据
				statsData.forEach((row, index) => {
					const addedRow = statsWorksheet.addRow(row);
					if (index === 0) {
						// 表头样式
						addedRow.eachCell((cell) => {
							cell.font = { bold: true };
							cell.fill = {
								type: 'pattern',
								pattern: 'solid',
								fgColor: { argb: 'E7E6E6' },
							};
						});
					}
				});

				// 设置统计表列宽
				statsWorksheet.columns = [
					{ width: 15 },
					{ width: 15 },
					{ width: 12 },
				];

				// 发送进度更新
				event.sender.send('export-progress', {
					progress: 90,
					status: 'processing',
					message: '保存Excel文件...',
				});

				// 保存文件
				await workbook.xlsx.writeFile(result.filePath);

				// 生成并输出调试报告
				const debugSummary = excelImageDebugger.getSummary();
				logToFile('\n=== 📊 Excel图片嵌入调试摘要 ===');
				logToFile(`总图片数: ${debugSummary.total}`);
				logToFile(`成功嵌入: ${debugSummary.successful}`);
				logToFile(`嵌入失败: ${debugSummary.failed}`);
				logToFile(`成功率: ${debugSummary.successRate.toFixed(1)}%`);
				logToFile(`处理时间: ${debugSummary.processingTime}ms`);

				if (debugSummary.failed > 0) {
					logToFile('\n📋 详细调试报告:');
					logToFile(excelImageDebugger.generateReport());
				}

				// 发送完成进度
				event.sender.send('export-progress', {
					progress: 100,
					status: 'completed',
					message: `导出完成！文件已保存至: ${path.basename(
						result.filePath
					)}`,
				});

				return true;
			}
			return false;
		} catch (error) {
			logToFile('Error exporting OCR results:', error);

			// 发送错误进度
			event.sender.send('export-progress', {
				progress: 0,
				status: 'error',
				message: `导出失败: ${
					error instanceof Error ? error.message : '未知错误'
				}`,
			});

			throw error;
		}
	}
);

// 获取图片文件扩展名
function getImageExtension(fileName?: string): 'jpeg' | 'png' | 'gif' {
	// 参数验证
	if (!fileName || typeof fileName !== 'string') {
		console.warn(
			`⚠️ Invalid fileName provided to getImageExtension: ${fileName}`
		);
		return 'jpeg'; // 默认返回jpeg
	}

	const ext = path.extname(fileName).toLowerCase();
	switch (ext) {
		case '.jpg':
		case '.jpeg':
			return 'jpeg';
		case '.png':
			return 'png';
		case '.gif':
			return 'gif';
		case '.bmp':
			return 'jpeg'; // BMP转换为JPEG
		case '.webp':
			return 'jpeg'; // WebP转换为JPEG
		default:
			console.warn(
				`⚠️ Unknown file extension: ${ext}, defaulting to jpeg`
			);
			return 'jpeg'; // 默认为jpeg
	}
}

// 验证图片缓冲区数据是否有效
function validateImageBuffer(buffer: Buffer, extension: string): boolean {
	try {
		if (!buffer || buffer.length === 0) {
			return false;
		}

		// 检查文件头魔数
		const uint8Array = new Uint8Array(buffer);

		switch (extension) {
			case 'jpeg':
				// JPEG: FF D8 FF
				return (
					uint8Array[0] === 0xff &&
					uint8Array[1] === 0xd8 &&
					uint8Array[2] === 0xff
				);
			case 'png':
				// PNG: 89 50 4E 47 0D 0A 1A 0A
				return (
					uint8Array[0] === 0x89 &&
					uint8Array[1] === 0x50 &&
					uint8Array[2] === 0x4e &&
					uint8Array[3] === 0x47
				);
			case 'gif':
				// GIF: 47 49 46 38
				return (
					uint8Array[0] === 0x47 &&
					uint8Array[1] === 0x49 &&
					uint8Array[2] === 0x46 &&
					uint8Array[3] === 0x38
				);
			default:
				// 对于其他格式，进行基本的图片格式检查
				const isJPEG = uint8Array[0] === 0xff && uint8Array[1] === 0xd8;
				const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50;
				const isGIF = uint8Array[0] === 0x47 && uint8Array[1] === 0x49;
				const isBMP = uint8Array[0] === 0x42 && uint8Array[1] === 0x4d;
				return isJPEG || isPNG || isGIF || isBMP;
		}
	} catch (error) {
		logToFile('Error validating image buffer:', error);
		return false;
	}
}

// 获取状态文本
function getStatusText(status: string): string {
	const statusMap: { [key: string]: string } = {
		pending: '待识别',
		processing: '识别中',
		completed: '已完成',
		error: '识别失败',
	};
	return statusMap[status] || status;
}

// 计算平均置信度
function calculateAverageConfidence(images: any[]): string {
	const completedImages = images.filter(
		(img) =>
			img.status === 'completed' && typeof img.confidence === 'number'
	);

	if (completedImages.length === 0) {
		return '无数据';
	}

	const totalConfidence = completedImages.reduce(
		(sum, img) => sum + img.confidence,
		0
	);
	const average = ((totalConfidence / completedImages.length) * 100).toFixed(
		1
	);
	return `${average}%`;
}

// 计算总图片大小
function calculateTotalImageSize(images: any[]): string {
	let totalSize = 0;

	images.forEach((image) => {
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
			logToFile('Cleaning up OCR worker...');
			await ocrWorker.terminate();
			ocrWorker = null;
			currentWorkerLanguage = '';
			logToFile('OCR worker terminated successfully');
		} catch (error) {
			logToFile('Error terminating OCR worker:', error);
		}
	}
}

// 清理临时文件夹
function cleanupTempDirectory() {
	try {
		const tempDir = path.join(app.getPath('temp'), 'tyf-tool', 'temp');
		if (fs.existsSync(tempDir)) {
			const files = fs.readdirSync(tempDir);
			files.forEach((file) => {
				const filePath = path.join(tempDir, file);
				try {
					fs.unlinkSync(filePath);
				} catch (error) {
					logToFile(`Error deleting temp file ${filePath}:`, error);
				}
			});
			logToFile(`Cleaned up ${files.length} temporary files`);
			logToFile(`已清理 ${files.length} 个临时文件`);
		}
	} catch (error) {
		logToFile('Error cleaning up temp directory:', error);
	}
}

// 应用退出时清理资源
app.on('before-quit', async () => {
	console.log('应用退出，清理资源');
	logToFile('===== 应用退出，开始清理资源 =====');
	await cleanupOCRResources();
	logToFile('OCR资源已清理');
	cleanupTempDirectory();
	logToFile('临时目录已清理');
	if (pythonOCRService) {
		console.log('清理Python服务');
		logToFile('正在终止Python服务');
		pythonOCRService.kill();
		pythonOCRService = null;
		logToFile('Python服务已终止');
	}
	logToFile('===== 应用退出完成 =====');
});
// Python服务进程引用
let pythonOCRService: ChildProcess | null = null;
const PYTHON_SERVICE_PORT = 8000;

// 检测系统类型和架构
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isArm64 = process.arch === 'arm64';

console.log('系统类型:', process.platform);
console.log('架构:', process.arch);

console.log(app.getAppPath());
// // 根据环境选择Python服务路径
// const PYTHON_SERVICE_PATH =
// 	process.env.NODE_ENV === 'development'
// 		? path.join(
// 				__dirname,
// 				'..',
// 				'tyf-tool-service',
// 				'dist',
// 				'tyf_tool_service'
// 		  ) // 开发环境路径
// 		: path.join(app.getAppPath(), 'service', 'tyf_tool_service'); // 生产环境路径
// // 或者如果是独立可执行文件
// // const PYTHON_SERVICE_PATH = path.join(app.getAppPath(), 'tyf-tool-service', 'dist', 'tyf-tool-service');
logToFile('NODE_ENV', process.env.NODE_ENV);

// 根据系统和架构选择Python服务路径
const getPythonServicePath = () => {
	// 检查是否为打包后的应用（使用app.isPackaged替代NODE_ENV判断）
	if (!app.isPackaged) {
		// const basePath = path.join(
		// 	__dirname,
		// 	'..',
		// 	'tyf-tool-service',
		// 	'dist',
		// 	'service'
		// );

		// ！！开发环境路径需要特别设置
		// 生产环境路径
		// const basePath = path.join(app.getAppPath(), 'dist', 'service');
		const basePath = path.join(
			app.getAppPath(),
			'..',
			'app.asar.unpacked',
			'dist',
			'service'
		);

		if (isWindows) {
			return path.join(basePath, 'tyf_tool_service.exe');
		} else if (isMac) {
			if (isArm64) {
				return path.join(basePath, 'tyf_tool_service');
			} else {
				return path.join(basePath, 'tyf_tool_service');
			}
		}
	}
	// 生产环境路径
	else {
		const basePath = path.join(
			app.getAppPath(),
			'..',
			'app.asar.unpacked',
			'dist',
			'service'
		);

		if (isWindows) {
			return path.join(basePath, 'tyf_tool_service.exe');
		} else if (isMac) {
			return path.join(basePath, 'tyf_tool_service');
		}
	}
};

// 启动Python OCR服务
ipcMain.handle('startPythonService', async () => {
	try {
		if (pythonOCRService) {
			logToFile('Python服务已经在运行');
			return true; // 服务已经在运行
		}

		// 获取适合当前系统和架构的可执行文件路径
		const servicePath = getPythonServicePath();
		console.log(`Starting Python service from: ${servicePath}`);
		logToFile(`尝试启动Python服务，路径: ${servicePath}`);

		// 检查文件是否存在
		if (!fs.existsSync(servicePath)) {
			const errorMsg = `服务文件不存在: ${servicePath}`;
			console.error(errorMsg);
			logToFile(errorMsg);
			return [false, errorMsg];
		}

		// 在Mac系统中添加可执行权限
		if (isMac) {
			try {
				fs.chmodSync(servicePath, '755');
				logToFile(`已为服务文件添加可执行权限: ${servicePath}`);
			} catch (chmodError) {
				const errorMsg = `无法设置可执行权限: ${chmodError}`;
				logToFile(errorMsg);
				// 尝试继续执行，可能会失败
			}
		}

		// 启动服务
		// 在Windows系统中，如果路径包含空格，确保正确处理
		if (isWindows && servicePath.includes(' ')) {
			// Windows会自动处理带引号的路径
			pythonOCRService = spawn(servicePath, [], {
				windowsVerbatimArguments: true,
			});
		} else {
			pythonOCRService = spawn(servicePath, []);
		}

		pythonOCRService.stdout?.on('data', (data) => {
			console.log(`Python OCR Service: ${data}`);
			logToFile(`Python服务输出: ${data}`);
		});

		pythonOCRService.stderr?.on('data', (data) => {
			logToFile(`Python OCR Service Error: ${data}`);
			logToFile(`Python服务错误: ${data}`);
		});

		pythonOCRService.on('close', (code) => {
			console.log(`Python OCR Service exited with code ${code}`);
			logToFile(`Python服务退出，退出码: ${code}`);
			pythonOCRService = null;
		});

		// 在Windows系统上，有时需要等待一段时间确保服务正常启动
		if (isWindows) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		return [true, null];
	} catch (error) {
		const servicePath = getPythonServicePath();
		logToFile('Failed to start Python OCR service:', error);
		logToFile(`启动Python服务失败: ${error}`);
		logToFile(
			`错误详情: ${JSON.stringify({
				servicePath,
				isArm64,
				isMac,
				isWindows,
			})}`
		);
		return [
			false,
			error,
			{
				servicePath,
				isArm64,
				isMac,
				isWindows,
			},
		];
	}
});

// 停止Python OCR服务
ipcMain.handle('stopPythonService', async () => {
	try {
		if (pythonOCRService) {
			logToFile('尝试停止Python服务');
			// Windows上可能需要使用taskkill强制结束进程
			if (isWindows) {
				// 首先尝试正常结束进程
				pythonOCRService.kill();
				logToFile('Windows系统：已发送kill信号');

				// 给一点时间让进程正常退出
				await new Promise((resolve) => setTimeout(resolve, 500));

				// 如果进程仍在运行，可以考虑使用更强力的方法
				// 注意：这部分可能需要额外的系统权限
				// 如果你需要这部分功能，可以使用Node的child_process.exec执行taskkill命令
			} else {
				// Mac和Linux可以使用SIGTERM信号
				pythonOCRService.kill('SIGTERM');
				logToFile('Mac/Linux系统：已发送SIGTERM信号');
			}

			pythonOCRService = null;
			logToFile('Python服务已停止');
		} else {
			logToFile('无需停止Python服务：服务未运行');
		}
		return true;
	} catch (error) {
		logToFile('Failed to stop Python OCR service:', error);
		logToFile(`停止Python服务失败: ${error}`);
		return false;
	}
});

// 检查Python OCR服务是否在运行
ipcMain.handle('isPythonServiceRunning', async () => {
	try {
		const response = await axios.get(
			`http://localhost:${PYTHON_SERVICE_PORT}/docs`
		);
		return response.status === 200;
	} catch (error) {
		return false;
	}
});

// 使用Python OCR服务进行识别
ipcMain.handle(
	'recognizeImageWithPythonService',
	async (
		event,
		imageData: ArrayBuffer,
		fileName: string,
		options: any = {}
	) => {
		try {
			// 检查服务是否运行
			const isRunning = await (
				global as any
			).window?.electronAPI?.isPythonServiceRunning?.();
			if (!isRunning) {
				await (
					global as any
				).window?.electronAPI?.startPythonService?.();
			}

			// 将ArrayBuffer转换为Base64
			const buffer = Buffer.from(imageData);
			const base64Image = buffer.toString('base64');

			// 调用Python服务
			const response = await axios.post(
				`http://localhost:${PYTHON_SERVICE_PORT}/recognize`,
				{ image_base64: base64Image },
				{ timeout: 120000 } // 2分钟超时
			);

			return response.data;
		} catch (error) {
			logToFile('Error calling Python OCR service:', error);
			throw error;
		}
	}
);

// 处理OCR工作器重置
ipcMain.handle('reset-ocr-worker', async () => {
	try {
		await cleanupOCRResources();
		cleanupTempDirectory();
		console.log('OCR worker reset successfully');
		logToFile('OCR worker reset successfully');
		return true;
	} catch (error) {
		logToFile('Error resetting OCR worker:', error);
		logToFile(`Error resetting OCR worker: ${error}`);
		throw error;
	}
});

// 递归获取目录内容
function getDirectoryContents(
	directoryPath: string,
	maxDepth: number = 3,
	currentDepth: number = 0
): any {
	try {
		if (currentDepth > maxDepth) return null;

		const result: any = {
			path: directoryPath,
			name: path.basename(directoryPath),
			isDirectory: true,
			children: [],
		};

		const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(directoryPath, entry.name);

			if (entry.isDirectory()) {
				const subDir = getDirectoryContents(
					fullPath,
					maxDepth,
					currentDepth + 1
				);
				if (subDir) {
					result.children.push(subDir);
				}
			} else {
				result.children.push({
					path: fullPath,
					name: entry.name,
					isDirectory: false,
					size: fs.statSync(fullPath).size,
				});
			}
		}

		return result;
	} catch (error) {
		logToFile(`读取目录内容出错: ${directoryPath}`, error);
		return null;
	}
}

// 添加IPC处理程序
ipcMain.handle('getAppContents', async (event, options = {}) => {
	try {
		const appPath = app.getAppPath();
		logToFile(`获取应用目录内容: ${appPath}`);

		const maxDepth = options.maxDepth || 3; // 默认递归深度为3
		const contents = getDirectoryContents(appPath, maxDepth);

		return contents;
	} catch (error) {
		logToFile('获取应用目录内容失败:', error);
		throw error;
	}
});
