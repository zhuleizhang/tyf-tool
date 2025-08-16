import React from 'react';
import { Card, Typography, List, Tag, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  FileExcelOutlined, 
  PictureOutlined,
  BarChartOutlined,
  SettingOutlined,
  CloudDownloadOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const ExportFeatures: React.FC = () => {
  const features = [
    {
      icon: <FileExcelOutlined style={{ color: '#52c41a' }} />,
      title: '完整Excel导出',
      description: '生成包含所有识别数据的专业Excel文件',
      details: ['图片信息', '识别文字', '置信度', '文件大小', '错误信息']
    },
    {
      icon: <PictureOutlined style={{ color: '#1890ff' }} />,
      title: '图片信息处理',
      description: '智能处理图片数据并优化存储',
      details: ['图片压缩', '格式转换', '尺寸优化', '类型识别', '路径记录']
    },
    {
      icon: <BarChartOutlined style={{ color: '#722ed1' }} />,
      title: '统计信息生成',
      description: '自动生成详细的识别统计报告',
      details: ['成功率统计', '平均置信度', '文件大小统计', '错误分析', '时间记录']
    },
    {
      icon: <SettingOutlined style={{ color: '#fa8c16' }} />,
      title: '表格格式优化',
      description: '专业的表格样式和布局设计',
      details: ['自适应列宽', '合理行高', '样式美化', '数据验证', '多工作表']
    },
    {
      icon: <CloudDownloadOutlined style={{ color: '#13c2c2' }} />,
      title: '导出进度显示',
      description: '实时显示导出进度和状态信息',
      details: ['进度条显示', '状态提示', '错误处理', '成功反馈', '取消支持']
    }
  ];

  const exportStructure = [
    {
      sheet: 'OCR识别结果',
      description: '主要数据表，包含所有图片的识别结果',
      columns: [
        '序号', '文件名', '文件大小(KB)', '图片类型', 
        '识别状态', '置信度', '识别文字', '错误信息', '图片路径'
      ]
    },
    {
      sheet: '图片信息',
      description: '详细的图片处理信息和技术参数',
      columns: [
        '序号', '文件名', '原始大小', '压缩后大小', 
        'MIME类型', '预计尺寸', '文件路径', '处理状态'
      ]
    },
    {
      sheet: '统计信息',
      description: '整体识别统计和汇总数据',
      columns: ['项目', '数值', '百分比']
    }
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <Card>
        <Title level={4}>
          <FileExcelOutlined /> Excel导出功能特性
        </Title>
        
        <Paragraph>
          全新的Excel导出功能提供了专业级的数据导出体验，包含完整的图片信息处理、
          统计分析和进度反馈。导出的Excel文件结构清晰，便于查看和后续处理。
        </Paragraph>

        <Title level={5} style={{ marginTop: 24 }}>功能特性</Title>
        <List
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}
          dataSource={features}
          renderItem={item => (
            <List.Item>
              <Card size="small" hoverable>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    {item.icon}
                    <Text strong>{item.title}</Text>
                  </Space>
                  <Text type="secondary">{item.description}</Text>
                  <div>
                    {item.details.map((detail, index) => (
                      <Tag key={index} color="blue" style={{ margin: '2px' }}>
                        {detail}
                      </Tag>
                    ))}
                  </div>
                </Space>
              </Card>
            </List.Item>
          )}
        />

        <Title level={5} style={{ marginTop: 24 }}>导出文件结构</Title>
        <List
          dataSource={exportStructure}
          renderItem={item => (
            <List.Item>
              <Card size="small" style={{ width: '100%' }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text strong>{item.sheet}</Text>
                  </Space>
                  <Text type="secondary">{item.description}</Text>
                  <div>
                    <Text type="secondary">包含字段：</Text>
                    {item.columns.map((col, index) => (
                      <Tag key={index} style={{ margin: '2px' }}>
                        {col}
                      </Tag>
                    ))}
                  </div>
                </Space>
              </Card>
            </List.Item>
          )}
        />

        <div style={{ marginTop: 16, padding: 16, backgroundColor: '#f6ffed', borderRadius: 6 }}>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text type="success">
              <strong>提示：</strong>
              导出的Excel文件包含多个工作表，提供了完整的数据分析和统计信息。
              图片信息以文本形式记录，便于后续处理和分析。
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default ExportFeatures;