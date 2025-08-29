const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

/**
 * @type {import('webpack').Configuration}
 */
const baseConfig = {
	mode: process.env.NODE_ENV || 'development',
	...(isDev
		? {
				devtool: 'source-map',
		  }
		: {}),
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
		alias: {
			// 添加这个别名配置
			'@': path.resolve(__dirname, 'src'),
		},
	},
	// 启用优化，确保Tree Shaking生效
	optimization: {
		usedExports: true, // 标记未使用的导出
		sideEffects: true, // 尊重package.json中的sideEffects标记
	},
};

/**
 * @type {import('webpack').Configuration}
 */
const rendererConfig = {
	...baseConfig,
	entry: './src/App.tsx',
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
	output: {
		filename: isDev ? '[name].js' : '[name].[contenthash:4].js', // 添加contenthash用于缓存优化
		chunkFilename: isDev
			? '[name].chunk.js'
			: '[name].[contenthash:4].chunk.js', // 为代码分割的chunk添加命名
		path: path.resolve(__dirname, 'dist'),
		globalObject: 'this', // 添加这一行，使用'this'代替'global'
	},
	// 添加代码分割配置
	optimization: {
		...baseConfig.optimization,
		splitChunks: {
			chunks: 'all', // 对所有chunk启用分割
			maxInitialRequests: 10, // 入口点的最大并行请求数
			minSize: 20000, // 生成chunk的最小大小（bytes）
			cacheGroups: {
				vendors: {
					test: /[\\/]node_modules[\\/]/, // 将node_modules中的模块打包到vendors chunk中
					name: 'vendors',
					priority: -10,
					enforceSizeThreshold: 50000, // 强制执行分离的尺寸阈值
				},
				common: {
					minChunks: 2, // 至少被两个chunk引用的模块
					priority: -20,
					reuseExistingChunk: true,
					name: 'common',
				},
			},
		},
		runtimeChunk: 'single', // 将webpack运行时代码提取到单独的chunk
	},
	plugins: [
		new HtmlWebpackPlugin({ template: './public/index.html' }),
		new CopyPlugin({
			patterns: (() => {
				// 基本复制配置
				const patterns = [
					// {
					// 	from: path.resolve(__dirname, 'index.html'),
					// 	to: path.resolve(__dirname, 'dist'),
					// },
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

/**
 * @type {import('webpack').Configuration}
 */
const mainConfig = {
	...baseConfig,
	mode: process.env.NODE_ENV || 'development',
	target: 'electron-main',
	entry: './src/main.ts',
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env',
							'@babel/preset-typescript',
						],
					},
				},
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
		filename: 'main.js',
		path: path.resolve(__dirname, 'dist'),
	},
};

module.exports = [mainConfig, rendererConfig];
