const path = require('path');

module.exports = {
	mode: 'development',
	target: 'electron-main',
	entry: './src/main.ts',
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
							[
								'@babel/preset-env',
								{
									targets: { node: '18' },
									modules: 'cjs',
								},
							],
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
		libraryTarget: 'commonjs2',
	},
	externals: {
		electron: 'commonjs2 electron',
		'tesseract.js': 'commonjs2 tesseract.js',
		xlsx: 'commonjs2 xlsx',
	},
	node: {
		__dirname: false,
		__filename: false,
	},
};
