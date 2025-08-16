import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
	Table,
	Button,
	Space,
	Image,
	Input,
	Tag,
	Popconfirm,
	Tooltip,
	Progress,
} from 'antd';
import {
	DeleteOutlined,
	EyeOutlined,
	EditOutlined,
	SaveOutlined,
	CloseOutlined,
	DragOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { ImageData } from '../index';

const { TextArea } = Input;

interface ImageTableProps {
	images: ImageData[];
	onRemove: (id: string) => void;
	onRecognize: (id: string) => void;
	onUpdateText: (id: string, text: string) => void;
	onReorder: (dragIndex: number, hoverIndex: number) => void;
}

interface DragItem {
	index: number;
	id: string;
	type: string;
}

// 编辑组件，使用React.memo优化
const EditableTextArea: React.FC<{
	disabled?: boolean;
	value: string;
	onChange: (value: string) => void;
	onSave: () => void;
	onCancel: () => void;
}> = React.memo(({ disabled, value, onChange, onSave, onCancel }) => {
	const [innerValue, setInnerValue] = useState(value);

	const handleChangeInnerValue = useCallback((value: string) => {
		setInnerValue(value);
	}, []);

	return (
		<div style={{ minWidth: '300px' }}>
			<TextArea
				disabled={disabled}
				value={innerValue}
				onChange={(e) => handleChangeInnerValue(e.target.value)}
				onBlur={() => onChange(innerValue)}
				onFocus={() => setInnerValue(value)}
				rows={4}
				style={{ marginBottom: '8px' }}
				placeholder="请输入识别结果..."
			/>
		</div>
	);
});

// 可拖拽的表格行组件
const DragableRow: React.FC<{
	index: number;
	moveRow: (dragIndex: number, hoverIndex: number) => void;
	children: React.ReactNode;
}> = ({ index, moveRow, children, ...restProps }) => {
	const [{ isDragging }, drag] = useDrag({
		type: 'row',
		item: { index },
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	});

	const [, drop] = useDrop({
		accept: 'row',
		hover: (item: DragItem) => {
			if (!item || item.index === index) {
				return;
			}
			moveRow(item.index, index);
			item.index = index;
		},
	});

	return (
		<tr
			ref={(node) => drag(drop(node))}
			style={{
				opacity: isDragging ? 0.5 : 1,
				cursor: 'move',
			}}
			{...restProps}
		>
			{children}
		</tr>
	);
};

const ImageTable: React.FC<ImageTableProps> = ({
	images,
	onRemove,
	onRecognize,
	onUpdateText,
	onReorder,
}) => {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingText, setEditingText] = useState<string>('');

	const handleEdit = useCallback((record: ImageData) => {
		setEditingId(record.id);
		setEditingText(record.text);
	}, []);

	const handleSave = useCallback(() => {
		if (editingId) {
			onUpdateText(editingId, editingText);
			setEditingId(null);
			setEditingText('');
		}
	}, [editingId, editingText, onUpdateText]);

	const handleCancel = useCallback(() => {
		setEditingId(null);
		setEditingText('');
	}, []);

	const handleTextChange = useCallback((value: string) => {
		setEditingText(value);
	}, []);

	const getStatusTag = (status: ImageData['status']) => {
		const statusConfig = {
			pending: { color: 'default', text: '待识别' },
			processing: { color: 'processing', text: '识别中' },
			completed: { color: 'success', text: '已完成' },
			error: { color: 'error', text: '识别失败' },
		};

		const config = statusConfig[status];
		return <Tag color={config.color}>{config.text}</Tag>;
	};

	const columns: ColumnsType<ImageData> = [
		{
			title: '排序',
			width: 60,
			render: () => <DragOutlined style={{ cursor: 'move' }} />,
		},
		{
			title: '图片预览',
			dataIndex: 'url',
			width: 120,
			render: (url: string, record: ImageData) => (
				<Image
					src={url}
					alt={record.file.name}
					width={80}
					height={60}
					style={{ objectFit: 'cover', borderRadius: '4px' }}
					preview={{
						mask: <EyeOutlined />,
					}}
				/>
			),
		},
		{
			title: '文件名',
			dataIndex: 'file',
			width: 150,
			render: (file: File) => (
				<Tooltip title={file.name}>
					<div
						style={{
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
						}}
					>
						{file.name}
					</div>
				</Tooltip>
			),
		},
		{
			title: '文件大小',
			dataIndex: 'file',
			width: 100,
			render: (file: File) => {
				const size = file.size / 1024;
				return size > 1024
					? `${(size / 1024).toFixed(1)}MB`
					: `${size.toFixed(1)}KB`;
			},
		},
		{
			title: '识别状态',
			dataIndex: 'status',
			width: 100,
			render: (status: ImageData['status'], record: ImageData) => (
				<div>
					{getStatusTag(status)}
					{status === 'processing' &&
						record.progress !== undefined && (
							<Progress
								percent={record.progress}
								size="small"
								style={{ marginTop: '4px' }}
							/>
						)}
				</div>
			),
		},
		{
			title: '识别结果',
			dataIndex: 'text',
			render: (text: string, record: ImageData) => {
				const canEdit = record.status !== 'processing'; // 只有processing状态不能编辑

				return (
					<EditableTextArea
						value={text}
						disabled={!canEdit}
						onChange={(newValue) => {
							console.log('newValue', newValue);

							onUpdateText(record.id, newValue);
						}}
						onSave={handleSave}
						onCancel={handleCancel}
					/>
				);
			},
		},
		{
			title: '可信度',
			dataIndex: 'confidence',
			width: 100,
			render: (
				confidence: ImageData['confidence'],
				record: ImageData
			) => {
				if (confidence === undefined) {
					return <div>暂无</div>;
				}
				let confidenceText = confidence > 50 ? '高' : '低';
				let confidenceColor = confidence > 50 ? 'success' : 'error';

				return (
					<div>
						{confidence !== undefined && (
							<Tag color={confidenceColor}>{confidenceText}</Tag>
						)}
					</div>
				);
			},
		},
		{
			title: '操作',
			width: 150,
			render: (_, record: ImageData) => (
				<Space>
					<Button
						type="primary"
						size="small"
						icon={<EyeOutlined />}
						onClick={() => onRecognize(record.id)}
						loading={record.status === 'processing'}
						disabled={record.status === 'processing'}
					>
						识别
					</Button>
					<Popconfirm
						title="确定要删除这张图片吗？"
						onConfirm={() => onRemove(record.id)}
						okText="确定"
						cancelText="取消"
					>
						<Button danger size="small" icon={<DeleteOutlined />}>
							删除
						</Button>
					</Popconfirm>
				</Space>
			),
		},
	];

	const components = {
		body: {
			row: (props: any) => {
				const index = images.findIndex(
					(item) => item.id === props['data-row-key']
				);
				return (
					<DragableRow index={index} moveRow={onReorder} {...props} />
				);
			},
		},
	};

	return (
		<DndProvider backend={HTML5Backend}>
			<Table
				components={components}
				columns={columns}
				dataSource={images}
				rowKey="id"
				pagination={{
					pageSize: images.length > 50 ? 20 : 10, // 动态调整页面大小
					showSizeChanger: true,
					showQuickJumper: true,
					showTotal: (total, range) =>
						`第 ${range[0]}-${range[1]} 条，共 ${total} 张图片`,
					pageSizeOptions: ['10', '20', '50', '100'],
				}}
				scroll={{
					x: 1200,
					y: images.length > 20 ? 600 : undefined, // 大量数据时启用垂直滚动
				}}
				locale={{
					emptyText: '暂无图片，请先上传图片',
				}}
				size={images.length > 20 ? 'small' : 'middle'} // 大量数据时使用紧凑模式
				loading={false}
				bordered
				sticky // 粘性表头
			/>
		</DndProvider>
	);
};

// 使用React.memo优化渲染性能，避免不必要的重新渲染
export default React.memo(ImageTable, (prevProps, nextProps) => {
	// 只有当images数组发生变化时才重新渲染
	if (prevProps.images.length !== nextProps.images.length) {
		return false;
	}

	// 检查images数组中的每个元素是否发生变化
	for (let i = 0; i < prevProps.images.length; i++) {
		const prevImage = prevProps.images[i];
		const nextImage = nextProps.images[i];

		// 比较关键属性
		if (
			prevImage.id !== nextImage.id ||
			prevImage.text !== nextImage.text ||
			prevImage.status !== nextImage.status ||
			prevImage.progress !== nextImage.progress ||
			prevImage.confidence !== nextImage.confidence
		) {
			return false;
		}
	}

	// 其他props比较
	return (
		prevProps.onRemove === nextProps.onRemove &&
		prevProps.onRecognize === nextProps.onRecognize &&
		prevProps.onUpdateText === nextProps.onUpdateText &&
		prevProps.onReorder === nextProps.onReorder
	);
});
