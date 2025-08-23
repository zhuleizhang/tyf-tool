import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
	Card,
	Button,
	Space,
	message,
	Progress,
	Popconfirm,
	Typography,
	Collapse,
	Statistic,
	Row,
	Col,
	Tooltip,
	Alert,
	Spin,
	Tag,
} from 'antd';
import {
	UploadOutlined,
	DeleteOutlined,
	ExportOutlined,
	ClearOutlined,
	EyeOutlined,
	StopOutlined,
	ReloadOutlined,
	InfoCircleOutlined,
	ThunderboltOutlined,
	ClockCircleOutlined,
	CheckCircleOutlined,
	ExclamationCircleOutlined,
	CloudServerOutlined,
} from '@ant-design/icons';
import ImageUpload from './components/ImageUpload';
import ImageTable from './components/ImageTable';
import ExportButton from './components/ExportButton';
import ExportFeatures from './components/ExportFeatures';
import PerformanceMonitor from './components/PerformanceMonitor';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import LanguageSelector from './components/LanguageSelector';
import OptimizationInfo from './components/OptimizationInfo';
import { TextFilterSettings } from './components/TextFilterSettings';
import { useImageOCR } from './hooks/useImageOCR';
import { useImageManager } from './hooks/useImageManager';
import { useImageOcrConfig } from '../../hooks/useGlobalConfig';
import { createTextFilter } from '../../utils/textFilter';

const { Title, Text } = Typography;
const { Panel } = Collapse;

export interface ImageData {
	id: string;
	file: File;
	url: string;
	text: string;
	status: 'pending' | 'processing' | 'completed' | 'error';
	progress?: number;
	error?: string;
	confidence?: number;
}

// 服务包装器组件，处理服务初始化和状态监控
const ServiceWrapper: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [loading, setLoading] = useState(true);
	const [serviceRunning, setServiceRunning] = useState(false);
	const [serviceStarting, setServiceStarting] = useState(false);
	const [serviceStopping, setServiceStopping] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 检查服务状态
	const checkServiceStatus = useCallback(async () => {
		try {
			const isRunning =
				await window.electronAPI?.isPythonServiceRunning();
			console.log('服务状态检查结果:', isRunning);
			setServiceRunning(!!isRunning);

			// 如果服务运行中且页面还在loading状态，则取消loading
			if (isRunning && loading) {
				setLoading(false);
				console.log('Python服务已就绪');
			}

			return !!isRunning;
		} catch (err) {
			console.error('检查服务状态失败', err);
			setServiceRunning(false);
			return false;
		}
	}, [loading]);

	// 启动Python服务
	const startService = useCallback(async () => {
		try {
			setServiceStarting(true);
			setError(null);
			const res = await window.electronAPI?.startPythonService();
			if (res?.[0]) {
				console.log('Python服务启动成功', res?.[1], res?.[2]);
				// 启动服务成功后开始轮询检查服务状态
				await checkServiceStatus();
			} else {
				console.log('Python服务启动失败', res?.[1], res?.[2]);
				setError(JSON.stringify(res?.[1]) || '服务启动失败');
			}
		} catch (err) {
			console.log('Python服务启动错误', err);
			setError(
				`服务启动错误: ${
					err instanceof Error ? err.message : String(err)
				}`
			);
		} finally {
			setServiceStarting(false);
		}
	}, [checkServiceStatus]);

	// 停止Python服务
	const stopService = useCallback(async () => {
		try {
			setServiceStopping(true);
			setError(null);
			const res = await window.electronAPI?.stopPythonService();
			if (res) {
				console.log('Python服务停止成功');
				setServiceRunning(false);
				return true;
			} else {
				console.log('Python服务停止失败');
				setError('服务停止失败');
				return false;
			}
		} catch (err) {
			console.log('Python服务停止错误', err);
			setError(
				`服务停止错误: ${
					err instanceof Error ? err.message : String(err)
				}`
			);
			return false;
		} finally {
			setServiceStopping(false);
		}
	}, []);

	// 重启服务
	const restartService = useCallback(async () => {
		setError(null);
		// 先停止服务
		const stopSuccess = await stopService();
		setLoading(true);
		if (stopSuccess) {
			// 停止成功后，等待短暂延迟再启动
			setTimeout(() => {
				startService();
			}, 1000); // 等待1秒后启动
		} else {
			setError('服务重启失败：无法停止当前服务');
		}
	}, [stopService, startService]);

	// 初始化：首先检查服务状态，如果未运行则启动
	useEffect(() => {
		const initialize = async () => {
			// 首先检查服务是否已经在运行
			const isRunning = await checkServiceStatus();

			// 如果服务未运行，则启动服务
			if (!isRunning) {
				await startService();
			} else {
				// 服务已运行，直接取消loading状态
				setLoading(false);
			}
		};

		initialize();
	}, [checkServiceStatus, startService]);

	// 定期检查服务状态
	useEffect(() => {
		const intervalId = setInterval(checkServiceStatus, 3000); // 每3秒轮询一次
		return () => clearInterval(intervalId);
	}, [checkServiceStatus]);

	if (error) {
		return (
			<Alert
				type="error"
				message="服务异常"
				description={error}
				style={{ marginTop: 20, maxWidth: 500 }}
				action={
					<Button
						type="primary"
						danger
						onClick={restartService}
						disabled={serviceStarting || serviceStopping}
					>
						重启服务
					</Button>
				}
			/>
		);
	}

	// 如果正在加载，显示加载状态
	if (loading) {
		return (
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					height: '80vh',
				}}
			>
				<Spin size="large" />
				<div style={{ marginTop: 20 }}>
					<Text>
						{serviceStarting
							? '正在启动Python服务，请稍候...'
							: serviceStopping
							? '正在停止Python服务，请稍候...'
							: '服务启动中，大约需要1分钟，请稍候...'}
					</Text>
				</div>
			</div>
		);
	}

	// 渲染子组件，并传递服务状态和重启方法
	return (
		<div className="service-wrapper">
			{React.cloneElement(children as React.ReactElement, {
				serviceRunning,
				restartService,
				serviceStarting,
				serviceStopping,
			})}
		</div>
	);
};

const ImageOCR: React.FC<{
	serviceRunning?: boolean;
	restartService?: () => Promise<void>;
	serviceStarting?: boolean;
	serviceStopping?: boolean;
}> = ({
	serviceRunning = false,
	restartService = async () => {},
	serviceStarting = false,
	serviceStopping = false,
}) => {
	const [showStats, setShowStats] = useState(true);
	const [lastActivity, setLastActivity] = useState<string>('');
	const [selectedLanguage, setSelectedLanguage] = useState<string>('chi_sim'); // 默认中文模式

	// 获取文字过滤配置
	const [ocrConfig] = useImageOcrConfig();
	const textFilter = useMemo(() => {
		if (
			ocrConfig.textFilter.enabled &&
			ocrConfig.textFilter.rules.length > 0
		) {
			return createTextFilter(ocrConfig.textFilter.rules);
		}
		return null;
	}, [ocrConfig.textFilter]);

	const {
		images,
		addImages,
		removeImage,
		clearImages,
		updateImageText,
		reorderImages,
		getStats,
	} = useImageManager();

	// 包装updateImageText以支持文字过滤
	const updateImageTextWithFilter: typeof updateImageText = useCallback(
		(imageId: string, text: string, status, confidence) => {
			let filteredText = text;
			if (textFilter) {
				filteredText = textFilter.applyFilter(text);
			}
			updateImageText(imageId, filteredText, status, confidence);
		},
		[textFilter, updateImageText]
	);

	const {
		recognizeImage,
		recognizeAll,
		cancelRecognition,
		resetOCRWorker,
		clearCache,
		isProcessing,
		progress,
		currentProcessing,
		pendingCount,
		ocrStats,
	} = useImageOCR(images, updateImageTextWithFilter);

	// 计算统计信息
	const stats = useMemo(() => getStats(), [getStats]);

	const handleImageUpload = useCallback(
		(files: File[]) => {
			addImages(files);
			setLastActivity(`上传了 ${files.length} 张图片`);
		},
		[addImages]
	);

	const handleRecognizeAll = useCallback(async () => {
		if (images.length === 0) {
			message.warning('请先上传图片');
			return;
		}

		try {
			setLastActivity(`开始批量识别 ${images.length} 张图片`);
			await recognizeAll({ language: selectedLanguage });
			setLastActivity('批量识别完成');
		} catch (error) {
			setLastActivity('批量识别失败');
			console.error('Batch recognition error:', error);
		}
	}, [images.length, recognizeAll, selectedLanguage]);

	const handleRecognizeSingle = useCallback(
		async (imageId: string) => {
			const image = images.find((img) => img.id === imageId);
			try {
				setLastActivity(
					`识别图片: ${image?.file.name}（${getLanguageDisplayName(
						selectedLanguage
					)}模式）`
				);
				await recognizeImage(imageId);
				setLastActivity(`图片识别完成: ${image?.file.name}`);
			} catch (error) {
				setLastActivity(`图片识别失败: ${image?.file.name}`);
				console.error('Single recognition error:', error);
			}
		},
		[recognizeImage, images, selectedLanguage]
	);

	const handleCancelRecognition = useCallback(() => {
		cancelRecognition();
		setLastActivity('已取消识别操作');
	}, [cancelRecognition]);

	const handleResetOCR = useCallback(async () => {
		try {
			await resetOCRWorker();
			setLastActivity('OCR引擎已重置');
		} catch (error) {
			setLastActivity('OCR引擎重置失败');
		}
	}, [resetOCRWorker]);

	const handleClearCache = useCallback(() => {
		clearCache();
		setLastActivity('OCR缓存已清理');
	}, [clearCache]);

	const handleClearAll = useCallback(() => {
		clearImages();
		setLastActivity('已清空所有数据');
	}, [clearImages]);

	// 获取语言显示名称
	const getLanguageDisplayName = (language: string): string => {
		const languageMap: { [key: string]: string } = {
			chi_sim: '中文',
			eng: '英文',
			'chi_sim+eng': '中英混合',
		};
		return languageMap[language] || language;
	};

	// 处理语言变更
	const handleLanguageChange = useCallback((language: string) => {
		setSelectedLanguage(language);
		setLastActivity(`切换到${getLanguageDisplayName(language)}识别模式`);
	}, []);

	// 服务状态标签
	const ServiceStatusTag = () => {
		if (serviceStarting) {
			return (
				<Tag icon={<Spin size="small" />} color="processing">
					服务启动中
				</Tag>
			);
		}

		if (serviceStopping) {
			return (
				<Tag icon={<Spin size="small" />} color="warning">
					服务停止中
				</Tag>
			);
		}

		return serviceRunning ? (
			<Tag color="success" icon={<CloudServerOutlined />}>
				服务正常
			</Tag>
		) : (
			<Tooltip title="点击重启服务">
				<Tag
					color="error"
					icon={<ExclamationCircleOutlined />}
					style={{ cursor: 'pointer' }}
					onClick={() => restartService()}
				>
					服务异常
				</Tag>
			</Tooltip>
		);
	};

	return (
		<Card>
			<div style={{ marginBottom: '24px' }}>
				<div>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<Title level={4}>图片文字识别</Title>
						<div>
							<ServiceStatusTag />
						</div>
					</div>
					<div>
						<Text type="secondary">
							支持上传多张图片，自动识别图片中的文字内容，并导出为Excel文件
						</Text>
					</div>
					{!serviceRunning && (
						<Alert
							type="warning"
							message="服务未运行，识别功能将不可用"
							action={
								<Button
									type="primary"
									size="small"
									onClick={() => restartService()}
									disabled={
										serviceStarting || serviceStopping
									}
									loading={serviceStarting}
								>
									重新启动服务
								</Button>
							}
							style={{ marginTop: 8 }}
						/>
					)}
					{lastActivity && (
						<div style={{ marginTop: '8px' }}>
							<Text type="success" style={{ fontSize: '12px' }}>
								<ClockCircleOutlined /> 最近操作：
								{lastActivity}
							</Text>
						</div>
					)}
				</div>
			</div>

			{/* 统计信息面板 */}
			{images.length > 0 && (
				<Card
					title={
						<Space>
							<span>统计信息</span>
							<Button
								type="link"
								size="small"
								onClick={() => setShowStats(!showStats)}
							>
								{showStats ? '收起' : '展开'}
							</Button>
						</Space>
					}
					size="small"
					style={{ marginBottom: '16px' }}
				>
					<Row gutter={16}>
						<Col span={6}>
							<Statistic
								title="总图片数"
								value={stats.total}
								prefix={<UploadOutlined />}
							/>
						</Col>
						<Col span={6}>
							<Statistic
								title="已完成"
								value={stats.completed}
								prefix={<CheckCircleOutlined />}
								valueStyle={{ color: '#3f8600' }}
							/>
						</Col>
						<Col span={6}>
							<Statistic
								title="待识别"
								value={pendingCount}
								prefix={<ClockCircleOutlined />}
								valueStyle={{ color: '#1890ff' }}
							/>
						</Col>
						<Col span={6}>
							<Statistic
								title="识别失败"
								value={stats.error}
								prefix={<ExclamationCircleOutlined />}
								valueStyle={{ color: '#cf1322' }}
							/>
						</Col>
					</Row>

					{showStats && (
						<Row gutter={16} style={{ marginTop: '16px' }}>
							<Col span={6}>
								<Statistic
									title="总文件大小"
									value={(
										stats.totalSize /
										1024 /
										1024
									).toFixed(1)}
									suffix="MB"
								/>
							</Col>
							<Col span={6}>
								<Statistic
									title="平均置信度"
									value={stats.avgConfidence.toFixed(1)}
									suffix="%"
									valueStyle={{
										color:
											stats.avgConfidence > 80
												? '#3f8600'
												: '#faad14',
									}}
								/>
							</Col>
							<Col span={6}>
								<Statistic
									title="已处理数量"
									value={ocrStats.totalProcessed}
									prefix={<ThunderboltOutlined />}
								/>
							</Col>
							<Col span={6}>
								<Statistic
									title="平均处理时间"
									value={
										ocrStats.totalProcessed > 0
											? (
													ocrStats.totalTime /
													ocrStats.totalProcessed /
													1000
											  ).toFixed(1)
											: '0'
									}
									suffix="秒"
								/>
							</Col>
						</Row>
					)}
				</Card>
			)}

			{/* 语言选择区域 */}
			{/* <LanguageSelector
				selectedLanguage={selectedLanguage}
				onLanguageChange={handleLanguageChange}
			/> */}

			{/* 文字过滤设置 */}
			<TextFilterSettings
				onFilterChange={(enabled, rules) => {
					if (enabled && rules.length > 0) {
						setLastActivity(
							`文字过滤已启用，共${
								rules.filter((r) => r.enabled).length
							}个规则生效`
						);
					} else {
						setLastActivity('文字过滤已禁用');
					}
				}}
			/>
			<div style={{ marginBottom: '16px' }}></div>

			{/* 图片上传区域 */}
			<Card
				title="图片上传"
				size="small"
				style={{ marginBottom: '16px' }}
			>
				<ImageUpload onUpload={handleImageUpload} />
			</Card>

			{/* 操作按钮区域 */}
			<Card
				title="批量操作"
				size="small"
				style={{ marginBottom: '16px' }}
			>
				<Space wrap>
					{!isProcessing ? (
						<Button
							type="primary"
							icon={<EyeOutlined />}
							onClick={handleRecognizeAll}
							disabled={images.length === 0}
						>
							批量识别{' '}
							{images?.length > 0 && `(${images.length}张)`}
						</Button>
					) : (
						<Button
							danger
							icon={<StopOutlined />}
							onClick={handleCancelRecognition}
						>
							取消识别
						</Button>
					)}

					<ExportButton images={images} />

					<Popconfirm
						title="确定要清空所有数据吗？"
						onConfirm={handleClearAll}
						okText="确定"
						cancelText="取消"
					>
						<Button
							icon={<ClearOutlined />}
							disabled={images.length === 0}
							danger
						>
							清空数据
						</Button>
					</Popconfirm>
				</Space>

				{isProcessing && (
					<div style={{ marginTop: '16px' }}>
						<Alert
							message="正在进行OCR识别"
							description={
								<div>
									<Progress
										percent={Math.round(progress)}
										status="active"
										format={(percent) =>
											`${percent}% 识别中...`
										}
										strokeColor={{
											'0%': '#108ee9',
											'100%': '#87d068',
										}}
									/>
									{currentProcessing && (
										<div
											style={{
												marginTop: '8px',
												fontSize: '12px',
											}}
										>
											<Spin
												size="small"
												style={{
													marginRight: '8px',
												}}
											/>
											正在处理:{' '}
											{currentProcessing.split('/').pop()}
										</div>
									)}
									<div
										style={{
											marginTop: '8px',
											fontSize: '12px',
											color: '#666',
										}}
									>
										提示：可以按 Esc 键取消识别
									</div>
								</div>
							}
							type="info"
							showIcon
						/>
					</div>
				)}
			</Card>

			{/* 性能监控 */}
			{(isProcessing || ocrStats.totalProcessed > 0) && (
				<>
					<PerformanceMonitor
						isProcessing={isProcessing}
						ocrStats={ocrStats}
						imageCount={images.length}
					/>
					<div style={{ marginBottom: '16px' }}></div>
				</>
			)}

			{/* 性能提示 */}
			{images.length > 20 && (
				<Alert
					message="性能提示"
					description="当前图片数量较多，建议分批处理以获得更好的性能表现。"
					type="warning"
					showIcon
					style={{ marginBottom: '16px' }}
				/>
			)}

			{/* 图片列表区域 */}
			<Card
				title={
					<Space>
						<span>图片列表</span>
						<Text type="secondary">({images.length}张)</Text>
						{stats.completed > 0 && (
							<Text type="success">
								已完成 {stats.completed}/{images.length}
							</Text>
						)}
					</Space>
				}
				size="small"
			>
				{images.length === 0 ? (
					<div
						style={{
							textAlign: 'center',
							padding: '40px 0',
							color: '#999',
						}}
					>
						<UploadOutlined
							style={{
								fontSize: '48px',
								marginBottom: '16px',
							}}
						/>
						<div>暂无图片，请先上传图片</div>
						<div style={{ fontSize: '12px', marginTop: '8px' }}>
							支持拖拽上传或点击上传按钮，快捷键：Ctrl+U
						</div>
					</div>
				) : (
					<ImageTable
						images={images}
						onRemove={removeImage}
						onRecognize={handleRecognizeSingle}
						onUpdateText={updateImageTextWithFilter}
						onReorder={reorderImages}
					/>
				)}
			</Card>
		</Card>
	);
};

// 包装后的导出组件
const WrappedImageOCR: React.FC = () => {
	return (
		<ServiceWrapper>
			<ImageOCR />
		</ServiceWrapper>
	);
};

export default WrappedImageOCR;
