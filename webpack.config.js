const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	mode: 'development',
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
			patterns: [
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
					to: path.resolve(__dirname, 'dist/service/easyocr_models'),
				},
				{
					from: path.resolve(__dirname, 'service_build'),
					to: path.resolve(__dirname, 'dist/service'),
				},
			],
		}),
	],
};
