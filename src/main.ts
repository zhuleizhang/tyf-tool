const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { formatFileSize } from './utils/imageProcessor';
import { excelImageDebugger } from './utils/excelImageDebugger';

// 初始化dayjs时区插件
dayjs.extend(utc);
dayjs.extend(timezone);

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

		// 使用上海时间
		// 写入日志
		fs.appendFileSync(
			logFile,
			`${dayjs()
				.tz('Asia/Shanghai')
				.format('YYYY-MM-DD HH:mm:ss.SSS')}: ${logDataStringify}\n`
		);
	} catch (error) {
		// 如果写日志本身出错，不应该影响应用运行
		console.error('写入日志文件失败:', error);
	}
};

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
		(event: Event, errorCode: number, errorDescription: string) => {
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
ipcMain.handle('read-excel', async (event: any, filePath: string) => {
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
	async (event: any, data: any[], filePath: string) => {
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

// 处理OCR结果导出（支持图片嵌入）
ipcMain.handle(
	'export-ocr-excel',
	async (
		event: any,
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

// 清理临时文件夹
function cleanupTempDirectory() {
	try {
		const tempDir = path.join(app.getPath('temp'), 'tyf-tool', 'temp');
		if (fs.existsSync(tempDir)) {
			const files = fs.readdirSync(tempDir);
			files.forEach((file: any) => {
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
logToFile('NODE_ENV', process.env.NODE_ENV);

// 根据系统和架构选择Python服务路径
const getPythonServicePath = () => {
	// 检查是否为打包后的应用（使用app.isPackaged替代NODE_ENV判断）
	if (!app.isPackaged) {
		// 开发环境路径
		const basePath = path.join(app.getAppPath(), 'dist', 'service');

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
			return [true]; // 服务已经在运行
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

// 处理OCR工作器重置
ipcMain.handle('reset-ocr-worker', async () => {
	try {
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
ipcMain.handle('getAppContents', async (event: any, options: any = {}) => {
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
