const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	mode: 'development',
	entry: './src/renderer.tsx',
	target: 'electron-renderer',
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
	},
	output: {
		filename: 'renderer.js',
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
			],
		}),
	],
};
