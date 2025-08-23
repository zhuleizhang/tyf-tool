import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout, Tabs, Typography, message, Button, Space } from 'antd';
import {
	FileExcelOutlined,
	PictureOutlined,
	ReloadOutlined,
	SettingOutlined,
} from '@ant-design/icons';
import 'antd/dist/reset.css';
import TabPane from 'antd/es/tabs/TabPane';
import ExcelDiff from './pages/excel-diff';
import ImageOCR from './pages/image-ocr';
import { GlobalConfigModal } from './components/GlobalConfigModal';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;
console.log('NODE_ENV', process.env.NODE_ENV);

const App: React.FC = () => {
	const [configModalVisible, setConfigModalVisible] = useState(false);

	useEffect(() => {
		window.electronAPI?.getAppContents().then((res) => {
			console.log('获取应用目录内容:', res);
		});
	}, []);

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
						justifyContent: 'space-between',
						height: '100%',
					}}
				>
					<Title level={3} style={{ margin: 0 }}>
						🍑 的工具箱
					</Title>
					<Space>
						<Button
							type="text"
							icon={<ReloadOutlined />}
							onClick={() => window.location.reload()}
						>
							刷新页面
						</Button>
						<Button
							type="text"
							icon={<SettingOutlined />}
							onClick={() => setConfigModalVisible(true)}
							title="全局配置"
						>
							配置
						</Button>
					</Space>
				</div>
			</Header>

			<Content style={{ padding: '24px', paddingTop: 12 }}>
				<Tabs destroyOnHidden>
					<TabPane tab="Excel差异分析" key="1">
						<ExcelDiff />
					</TabPane>
					<TabPane tab={'图片文字识别'} key="2">
						<ImageOCR />
					</TabPane>
				</Tabs>
			</Content>

			<Footer style={{ textAlign: 'center' }}>
				🍑 的工具箱 ©{new Date().getFullYear()} Zhulei Zhang
			</Footer>

			{/* 全局配置模态框 */}
			<GlobalConfigModal
				visible={configModalVisible}
				onCancel={() => setConfigModalVisible(false)}
			/>
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
