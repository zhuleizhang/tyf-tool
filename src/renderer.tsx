import React, { useEffect, useMemo, useState } from 'react';
import { ipcRenderer } from 'electron';
import { createRoot } from 'react-dom/client';
import {
	Layout,
	Button,
	Card,
	Form,
	Select,
	InputNumber,
	Table,
	Typography,
	Space,
	Divider,
	message,
	Spin,
	Alert,
	Tag,
} from 'antd';
import {
	UploadOutlined,
	SearchOutlined,
	ExportOutlined,
	FileExcelOutlined,
	ReloadOutlined, // 导入刷新图标
} from '@ant-design/icons';
import 'antd/dist/reset.css';

const FormItemWidth = '200px';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Item } = Form;

interface ExcelData {
	name: string;
	data: any[];
	columnCount: number;
}

interface AnalysisResult {
	groupName: string;
	sheetName: string;
	checkColumn: string;
	items: {
		row: number;
		value: number;
	}[];
}

const App: React.FC = () => {
	const [filePath, setFilePath] = useState<string>('');
	const [excelData, setExcelData] = useState<ExcelData[]>([]);
	const [groupColumn, setGroupColumn] = useState<string>('');
	// 将checkColumn从字符串改为字符串数组
	const [checkColumns, setCheckColumns] = useState<string[]>([]);
	const [results, setResults] = useState<AnalysisResult[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [analysisPerformed, setAnalysisPerformed] = useState<boolean>(false);
	const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
	const [startRow, setStartRow] = useState<number>(1);
	const [maxColumnCount, setMaxColumnCount] = useState<number>(0);

	console.log(excelData, 'excelData');

	useEffect(() => {
		if (excelData.length === 0 || selectedSheets.length === 0) {
			setMaxColumnCount(0);
			return;
		}

		const maxCols = selectedSheets.reduce((max, sheetName) => {
			const sheet = excelData.find((s) => s.name === sheetName);
			return Math.max(max, sheet?.columnCount || 0);
		}, 0);

		setMaxColumnCount(maxCols);
	}, [excelData, selectedSheets]);

	const handleFileSelect = async () => {
		setLoading(true);
		try {
			const path = await ipcRenderer.invoke('select-file');
			if (path) {
				setFilePath(path);
				const data = await ipcRenderer.invoke('read-excel', path);
				setExcelData(data);
				message.success('文件加载成功');
			}
		} catch (error) {
			console.error('Error reading file:', error);
			message.error('文件加载失败');
		}
		setLoading(false);
	};

	// 添加刷新数据处理函数
	const handleRefreshData = async () => {
		if (!filePath) {
			message.warning('请先选择Excel文件');
			return;
		}

		setLoading(true);
		try {
			// 重新读取当前选中的文件
			const data = await ipcRenderer.invoke('read-excel', filePath);
			setExcelData(data);
			// 清空之前的分析结果
			setResults([]);
			setAnalysisPerformed(false);
			message.success('文件数据已刷新');
		} catch (error) {
			console.error('Error refreshing file data:', error);
			message.error('刷新数据失败');
		}
		setLoading(false);
	};

	const analyzeData = () => {
		if (
			!excelData.length ||
			!groupColumn ||
			checkColumns.length === 0 || // 更新验证条件
			selectedSheets.length === 0
		) {
			message.warning('请选择工作表、分组列和至少一个检查列');
			return;
		}

		setLoading(true);
		console.log('开始分析');

		const analysisResults: AnalysisResult[] = [];

		selectedSheets.forEach((sheetName) => {
			const sheet = excelData.find((s) => s.name === sheetName);
			if (!sheet) return;

			// 支持多个检查列的分析
			checkColumns.forEach((checkColumn) => {
				const groups = new Map<
					string,
					{ row: number; value: number }[]
				>();

				for (let i = startRow - 1; i < sheet.data.length; i++) {
					const row = sheet.data[i];
					const groupValue = row[groupColumn];
					const checkValue = parseFloat(row[checkColumn]);

					if (!isNaN(checkValue)) {
						if (!groups.has(groupValue)) {
							groups.set(groupValue, []);
						}
						groups.get(groupValue)?.push({
							row: i + 1,
							value: checkValue,
						});
					}
				}

				groups.forEach((items, groupName) => {
					if (items.length > 1) {
						const values = items.map((item) => item.value);
						const hasDifference = values.some(
							(v) => v !== values[0]
						);
						if (hasDifference) {
							analysisResults.push({
								sheetName,
								groupName,
								checkColumn, // 添加检查列信息
								items,
							});
						}
					}
				});
			});
		});

		setResults(analysisResults);
		setAnalysisPerformed(true);
		setLoading(false);
		message.info(`分析完成，发现${analysisResults.length}处差异`);
	};

	const exportResults = async () => {
		if (!results.length) {
			message.warning('没有可导出的结果');
			return;
		}

		setLoading(true);
		try {
			const exportData = results.flatMap((result) =>
				result.items.map((item) => ({
					分组名称: result.groupName,
					工作表名: result.sheetName,
					行号: item.row,
					检查值: item.value,
				}))
			);

			const path = await ipcRenderer.invoke('select-file', {
				properties: ['saveFile'],
				filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
			});

			if (path) {
				await ipcRenderer.invoke('export-results', exportData, path);
				message.success('导出成功');
			}
		} catch (error) {
			console.error('Error exporting results:', error);
			message.error('导出失败');
		}
		setLoading(false);
	};

	const columnOptions = useMemo(() => {
		return Array.from({ length: maxColumnCount }, (_, i) => {
			const columnName = String.fromCharCode(65 + i);
			return {
				label: `${columnName}列`,
				value: columnName,
			};
		});
	}, [maxColumnCount]);

	const resultColumns = [
		{
			title: '工作表名',
			dataIndex: 'sheetName',
			key: 'sheetName',
			width: 100,
		},
		{
			title: '分组名称',
			dataIndex: 'groupName',
			key: 'groupName',
			width: 200,
		},
		{
			title: '行号',
			dataIndex: 'row',
			key: 'row',
			width: 80,
		},
		{
			title: '检查列',
			dataIndex: 'checkColumn',
			key: 'checkColumn',
			width: 120,
		},
		{
			title: '检查值',
			dataIndex: 'value',
			key: 'value',
			width: 120,
			render: (value: number) => {
				return <Tag color="red">{value}</Tag>;
			},
		},
	];

	const resultData = useMemo(() => {
		return results.flatMap((result, index) => {
			const firstValue = result.items[0].value;
			return result.items.map((item, itemIndex) => ({
				key: `${index}-${itemIndex}`,
				groupName: result.groupName,
				sheetName: result.sheetName,
				checkColumn: result.checkColumn,
				row: item.row,
				value: item.value,
				firstValue,
			}));
		});
	}, [results]);

	return (
		<Layout className="layout" style={{ minHeight: '100vh' }}>
			<Header
				style={{
					background: '#fff',
					padding: '0 20px',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						height: '100%',
					}}
				>
					<FileExcelOutlined
						style={{
							fontSize: '24px',
							marginRight: '10px',
							color: '#1890ff',
						}}
					/>
					<Title level={3} style={{ margin: 0 }}>
						Excel异常数据分析工具
					</Title>
				</div>
			</Header>

			<Content style={{ padding: '24px' }}>
				<Spin spinning={loading} tip="处理中...">
					<Card
						title="文件选择"
						bordered={true}
						style={{ marginBottom: '24px' }}
						actions={[
							<Space key="file-actions" size="small">
								<Button
									type="primary"
									icon={<UploadOutlined />}
									onClick={handleFileSelect}
								>
									选择Excel文件
								</Button>
								{/* 添加刷新按钮 */}
								<Button
									icon={<ReloadOutlined />}
									onClick={handleRefreshData}
									disabled={!filePath || loading}
								>
									刷新数据
								</Button>
							</Space>,
						]}
					>
						{filePath ? (
							<Paragraph
								ellipsis={{
									rows: 1,
									expandable: true,
									symbol: '查看完整路径',
								}}
							>
								当前文件: {filePath}
							</Paragraph>
						) : (
							<Alert
								message="请选择Excel文件进行分析"
								type="info"
								showIcon
							/>
						)}
					</Card>

					{excelData.length > 0 && (
						<Card
							title="分析配置"
							bordered={true}
							style={{ marginBottom: '24px' }}
						>
							<Form
								layout="vertical"
								initialValues={{ startRow: 1 }}
							>
								<Space
									direction="vertical"
									size="large"
									style={{ width: '100%' }}
								>
									<Item
										label="选择工作表"
										name="sheets"
										rules={[
											{
												required: true,
												message: '请选择工作表',
											},
										]}
									>
										<Select
											mode="multiple"
											placeholder="请选择工作表"
											style={{ width: '100%' }}
											value={selectedSheets}
											onChange={(values) =>
												setSelectedSheets(
													values as string[]
												)
											}
										>
											{excelData.map((sheet) => (
												<Option
													key={sheet.name}
													value={sheet.name}
												>
													{sheet.name}
												</Option>
											))}
										</Select>
									</Item>

									<Space
										direction="horizontal"
										size="middle"
										wrap
										style={{ width: '100%' }}
									>
										<Item
											label="起始行"
											name="startRow"
											style={{ minWidth: FormItemWidth }}
										>
											<InputNumber
												min={1}
												value={startRow}
												onChange={(value) =>
													setStartRow(value || 1)
												}
												style={{ width: '100%' }}
											/>
										</Item>

										<Item
											label="分组列"
											name="groupColumn"
											style={{ minWidth: FormItemWidth }}
											rules={[
												{
													required: true,
													message: '请选择分组列',
												},
											]}
										>
											<Select
												placeholder="请选择分组列"
												style={{ width: '100%' }}
												value={groupColumn}
												onChange={(value) =>
													setGroupColumn(
														value as string
													)
												}
											>
												{columnOptions.map((option) => (
													<Option
														key={option.value}
														value={option.value}
													>
														{option.label}
													</Option>
												))}
											</Select>
										</Item>

										<Item
											label="检查列"
											name="checkColumn"
											style={{ minWidth: FormItemWidth }}
											rules={[
												{
													required: true,
													message:
														'请选择至少一个检查列',
												},
											]}
										>
											{/* 修改为支持多选 */}
											<Select
												mode="multiple"
												placeholder="请选择检查列"
												style={{ width: '100%' }}
												value={checkColumns}
												onChange={(value) =>
													setCheckColumns(
														value as string[]
													)
												}
											>
												{columnOptions.map((option) => (
													<Option
														key={option.value}
														value={option.value}
													>
														{option.label}
													</Option>
												))}
											</Select>
										</Item>

										<Button
											type="primary"
											icon={<SearchOutlined />}
											onClick={analyzeData}
											style={{
												height: '40px',
												alignSelf: 'flex-end',
											}}
										>
											开始分析
										</Button>
									</Space>
								</Space>
							</Form>
						</Card>
					)}

					{analysisPerformed && (
						<Card title="分析结果">
							<div
								style={{
									marginBottom: '16px',
									textAlign: 'right',
								}}
							>
								<Button
									icon={<ExportOutlined />}
									onClick={exportResults}
									disabled={results.length === 0}
								>
									导出结果
								</Button>
							</div>

							{results.length > 0 ? (
								<Table
									columns={resultColumns}
									dataSource={resultData}
									pagination={{
										showSizeChanger: true,
									}}
									size="middle"
									rowClassName={(record, index) =>
										index > 0 &&
										record.value !== record.firstValue
											? 'difference-row'
											: ''
									}
								/>
							) : (
								<Alert
									message="分析完成"
									description="未发现差异数据"
									type="success"
									showIcon
								/>
							)}
						</Card>
					)}
				</Spin>
			</Content>

			<Footer style={{ textAlign: 'center' }}>
				🍑 的工具箱 ©{new Date().getFullYear()} Created with Zhulei
				Zhang
			</Footer>
		</Layout>
	);
};

const container = document.getElementById('root');
const root = createRoot(container || document.body);
root.render(<App />);

window.addEventListener('error', (e) => {
	console.error('全局错误捕获:', e.error);
	message.error(`发生错误: ${e.error.message}`);
});

window.addEventListener('unhandledrejection', (e) => {
	console.error('未处理的Promise拒绝:', e.reason);
	message.error(`发生错误: ${e.reason.message}`);
});
