const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs'); // 添加fs模块

module.exports = {
	mode: process.env.NODE_ENV || 'development',
	entry: './src/App.tsx',
	target: 'electron-renderer',
	devtool: 'source-map',
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env', // 简化预设配置
							'@babel/preset-react',
							'@babel/preset-typescript',
						],
					},
				},
			},
			{
				test: /\.css$/i,
				use: [
					'style-loader', // 将CSS注入到DOM
					'css-loader', // 解析CSS文件
				],
			},
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
		alias: {
			// 添加这个别名配置
			'@': path.resolve(__dirname, 'src'),
		},
	},
	output: {
		filename: 'App.js',
		path: path.resolve(__dirname, 'dist'),
		libraryTarget: 'window',
		library: 'App',
		// 添加以下配置防止CommonJS导出
		environment: {
			arrowFunction: false,
			module: false,
		},
	},
	plugins: [
		new CopyPlugin({
			patterns: (() => {
				// 基本复制配置
				const patterns = [
					{
						from: path.resolve(__dirname, 'index.html'),
						to: path.resolve(__dirname, 'dist'),
					},
					{
						from: path.resolve(__dirname, 'preload.js'),
						to: path.resolve(__dirname, 'dist'),
					},
					{
						from: path.resolve(__dirname, 'src/assets'),
						to: path.resolve(__dirname, 'dist/assets'),
					},
					{
						from: path.resolve(
							__dirname,
							'tyf-tool-service/easyocr_models'
						),
						to: path.resolve(
							__dirname,
							'dist/service/easyocr_models'
						),
					},
				];

				// 检查service_build目录是否存在
				const serviceBuildPath = path.resolve(
					__dirname,
					'service_build'
				);
				if (fs.existsSync(serviceBuildPath)) {
					console.log('service_build目录存在，添加到复制配置');
					patterns.push({
						from: serviceBuildPath,
						to: path.resolve(__dirname, 'dist/service'),
					});
				} else {
					console.warn('警告: service_build目录不存在，跳过复制');
					// 如果需要，可以在这里创建一个空的service目录
					// fs.mkdirSync(path.resolve(__dirname, 'dist/service'), { recursive: true });
				}

				return patterns;
			})(),
		}),
	],
};
