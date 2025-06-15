import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as XLSX from 'xlsx';
// import * as fs from 'fs';

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
	const mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	mainWindow.loadFile(path.join(__dirname, '../index.html'));

	if (process.env.NODE_ENV === 'development') {
		mainWindow.webContents.openDevTools();
	}

	// // 添加此行强制打开开发者工具
	// mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
	try {
		createWindow();
	} catch (error) {
		console.log(error);
	}
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
