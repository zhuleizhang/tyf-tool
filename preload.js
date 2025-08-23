const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('versions', {
	node: () => process.versions.node,
	chrome: () => process.versions.chrome,
	electron: () => process.versions.electron,
	ping: () => ipcRenderer.invoke('ping'),
	// 除函数之外，我们也可以暴露变量
});

// 暴露Electron API给渲染进程
// 在electronAPI对象中添加以下内容
contextBridge.exposeInMainWorld('electronAPI', {
	// 现有的Excel相关API
	selectFile: () => ipcRenderer.invoke('select-file'),
	readExcel: (filePath) => ipcRenderer.invoke('read-excel', filePath),
	exportResults: (data, filePath) =>
		ipcRenderer.invoke('export-results', data, filePath),

	// 新增的OCR相关API
	selectImages: () => ipcRenderer.invoke('select-images'),
	exportOCRExcel: (data, images, imageBuffers) =>
		ipcRenderer.invoke('export-ocr-excel', data, images, imageBuffers),
	resetOCRWorker: () => ipcRenderer.invoke('reset-ocr-worker'),

	// 事件监听器
	on: (channel, callback) => {
		const validChannels = [
			'ocr-progress',
			'batch-ocr-progress',
			'export-progress',
		];
		if (validChannels.includes(channel)) {
			ipcRenderer.on(channel, (event, data) => callback(event, data));
		}
	},
	removeListener: (channel, callback) => {
		ipcRenderer.removeListener(channel, callback);
	},
	removeAllListeners: (channel) => {
		ipcRenderer.removeAllListeners(channel);
	},

	// OCR进度监听（保持向后兼容）
	onOCRProgress: (callback) => {
		ipcRenderer.on('ocr-progress', (event, data) => callback(data));
		return () => ipcRenderer.removeAllListeners('ocr-progress');
	},
	onBatchOCRProgress: (callback) => {
		ipcRenderer.on('batch-ocr-progress', (event, data) => callback(data));
		return () => ipcRenderer.removeAllListeners('batch-ocr-progress');
	},

	// 导出进度监听
	// onExportProgress: (callback) => {
	//     ipcRenderer.on('export-progress', (event, data) => callback(data));
	//     return () => ipcRenderer.removeAllListeners('export-progress');
	// }

	// Python服务API - 移除OCR部分
	startPythonService: () => ipcRenderer.invoke('startPythonService'),
	stopPythonService: () => ipcRenderer.invoke('stopPythonService'),
	isPythonServiceRunning: () => ipcRenderer.invoke('isPythonServiceRunning'),

	// 添加获取应用目录内容的API
	getAppContents: (options) => ipcRenderer.invoke('getAppContents', options),
});

window.addEventListener('DOMContentLoaded', () => {
	const replaceText = (selector, text) => {
		const element = document.getElementById(selector);
		if (element) element.innerText = text;
	};

	for (const type of ['chrome', 'node', 'electron']) {
		replaceText(`${type}-version`, process.versions[type]);
	}
});
