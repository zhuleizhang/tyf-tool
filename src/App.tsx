import React from 'react';
import { createRoot } from 'react-dom/client';
import { Layout, Tabs, Typography, message } from 'antd';
import {
	FileExcelOutlined,
	PictureOutlined
} from '@ant-design/icons';
import 'antd/dist/reset.css';
import TabPane from 'antd/es/tabs/TabPane';
import ExcelDiff from './pages/excel-diff';
import ImageOCR from './pages/image-ocr';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
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
						🍑 的工具箱
					</Title>
				</div>
			</Header>

			<Content style={{ padding: '24px' }}>
				<Tabs>
					<TabPane tab="Excel差异分析" key="1">
						<ExcelDiff />
					</TabPane>
					<TabPane 
						tab={
							<span>
								<PictureOutlined />
								图片文字识别
							</span>
						} 
						key="2"
					>
						<ImageOCR />
					</TabPane>
				</Tabs>
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