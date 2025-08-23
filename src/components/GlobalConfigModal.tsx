import React, { useState, useCallback, useEffect } from 'react';
import {
	Modal,
	Input,
	Button,
	message,
	Space,
	Typography,
	Alert,
	Spin,
} from 'antd';
import {
	ReloadOutlined,
	UndoOutlined,
	CheckCircleOutlined,
	ExclamationCircleOutlined,
} from '@ant-design/icons';
import { GlobalConfig } from '../types/config';
import { ConfigStorage } from '../utils/configStorage';
import { useGlobalConfig } from '../hooks/useGlobalConfig';

const { TextArea } = Input;
const { Text } = Typography;

interface GlobalConfigModalProps {
	visible: boolean;
	onCancel: () => void;
}

export const GlobalConfigModal: React.FC<GlobalConfigModalProps> = ({
	visible,
	onCancel,
}) => {
	const { config, updateConfig, resetConfig, reloadConfig, isLoading } =
		useGlobalConfig();
	const [jsonText, setJsonText] = useState('');
	const [validationResult, setValidationResult] = useState<{
		isValid: boolean;
		errors: string[];
	}>({
		isValid: true,
		errors: [],
	});
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	// 当模态框打开时，初始化JSON文本
	useEffect(() => {
		if (visible) {
			reloadConfig();
			setJsonText(JSON.stringify(ConfigStorage.loadConfig(), null, 2));
			setHasUnsavedChanges(false);
			setValidationResult({ isValid: true, errors: [] });
		}
	}, [visible]);

	// 验证JSON格式和配置内容
	const validateJson = useCallback((text: string) => {
		try {
			const parsed = JSON.parse(text);
			const validation = ConfigStorage.validateConfig(parsed);

			setValidationResult({
				isValid: validation.isValid,
				errors: validation.errors.map(
					(error) => `${error.path}: ${error.message}`
				),
			});

			return validation.isValid;
		} catch (error) {
			setValidationResult({
				isValid: false,
				errors: [
					`JSON格式错误: ${(error as Error)?.message || '未知错误'}`,
				],
			});
			return false;
		}
	}, []);

	// 处理文本变化
	const handleTextChange = useCallback(
		(value: string) => {
			setJsonText(value);
			setHasUnsavedChanges(true);
			validateJson(value);
		},
		[validateJson]
	);

	// 应用配置
	const handleApply = useCallback(async () => {
		if (!validationResult.isValid) {
			message.error('配置验证失败，请修复错误后重试');
			return;
		}

		try {
			const newConfig = JSON.parse(jsonText) as GlobalConfig;
			await updateConfig(newConfig);
			message.success('配置已保存，点击刷新页面按钮生效');
			setHasUnsavedChanges(false);
		} catch (error) {
			console.error('应用配置失败:', error);
			message.error(
				`应用配置失败: ${(error as Error)?.message || '未知错误'}`
			);
		}
	}, [jsonText, validationResult.isValid, updateConfig]);

	// 刷新配置
	const handleRefresh = useCallback(() => {
		reloadConfig();
		message.success('配置已刷新');
	}, [reloadConfig]);

	// 重置配置
	const handleReset = useCallback(() => {
		Modal.confirm({
			title: '确认重置',
			content: '确定要重置所有配置到默认值吗？此操作不可撤销。',
			onOk: () => {
				resetConfig();
				setJsonText(
					JSON.stringify(ConfigStorage.loadConfig(), null, 2)
				);
				setHasUnsavedChanges(false);
				setValidationResult({ isValid: true, errors: [] });
				message.success('配置已重置');
			},
		});
	}, [resetConfig]);

	// 处理模态框关闭
	const handleCancel = useCallback(() => {
		if (hasUnsavedChanges) {
			Modal.confirm({
				title: '确认关闭',
				content: '您有未保存的更改，确定要关闭吗？',
				onOk: onCancel,
			});
		} else {
			onCancel();
		}
	}, [hasUnsavedChanges, onCancel]);

	return (
		<Modal
			title="全局配置"
			open={visible}
			onCancel={handleCancel}
			width={800}
			footer={
				<Space>
					<Button onClick={handleCancel}>取消</Button>
					<Button
						icon={<UndoOutlined />}
						onClick={handleReset}
						danger
					>
						重置
					</Button>
					<Button
						type="primary"
						icon={<CheckCircleOutlined />}
						onClick={handleApply}
						disabled={!validationResult.isValid}
						loading={isLoading}
					>
						保存配置
					</Button>
				</Space>
			}
		>
			<Spin spinning={isLoading}>
				<div style={{ marginBottom: 16 }}>
					<Text type="secondary">
						在此处编辑全局配置，支持JSON格式。修改后需要点击"应用配置"保存，然后点击"刷新页面"按钮使配置全局生效。
					</Text>
				</div>

				{/* 验证结果显示 */}
				{!validationResult.isValid && (
					<Alert
						type="error"
						message="配置验证失败"
						description={
							<ul style={{ margin: 0, paddingLeft: 20 }}>
								{validationResult.errors.map((error, index) => (
									<li key={index}>{error}</li>
								))}
							</ul>
						}
						style={{ marginBottom: 16 }}
						showIcon
					/>
				)}

				{validationResult.isValid && (
					<Alert
						type="success"
						message="配置格式正确"
						style={{ marginBottom: 16 }}
						showIcon
					/>
				)}

				{/* JSON编辑器 */}
				<TextArea
					value={jsonText}
					onChange={(e) => handleTextChange(e.target.value)}
					placeholder="请输入JSON格式的配置..."
					rows={20}
					style={{
						fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
						fontSize: '12px',
					}}
				/>

				<div style={{ marginTop: 8 }}>
					<Text type="secondary" style={{ fontSize: '12px' }}>
						提示: 使用Ctrl+A全选，Ctrl+Z撤销，Ctrl+Y重做
					</Text>
				</div>
			</Spin>
		</Modal>
	);
};
