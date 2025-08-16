import React, { useState } from 'react';
import { Modal, Table, Typography, Button, Space } from 'antd';
import { QuestionCircleOutlined, KeyOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface ShortcutData {
  key: string;
  keys: string;
  description: string;
  context: string;
}

const KeyboardShortcuts: React.FC = () => {
  const [visible, setVisible] = useState(false);

  const shortcuts: ShortcutData[] = [
    {
      key: '1',
      keys: 'Ctrl + U',
      description: '打开图片上传对话框',
      context: '任何时候'
    },
    {
      key: '2',
      keys: 'Ctrl + R',
      description: '开始批量识别',
      context: '有待识别图片时'
    },
    {
      key: '3',
      keys: 'Ctrl + E',
      description: '导出Excel文件',
      context: '有图片数据时'
    },
    {
      key: '4',
      keys: 'Escape',
      description: '取消当前识别操作',
      context: '识别进行中'
    },
    {
      key: '5',
      keys: 'Ctrl + Shift + C',
      description: '清理OCR缓存',
      context: '任何时候'
    },
    {
      key: '6',
      keys: 'Ctrl + Shift + R',
      description: '重置OCR引擎',
      context: '任何时候'
    },
    {
      key: '7',
      keys: 'Delete',
      description: '删除选中的图片',
      context: '选中图片时'
    },
    {
      key: '8',
      keys: 'F5',
      description: '刷新页面',
      context: '任何时候'
    }
  ];

  const columns = [
    {
      title: '快捷键',
      dataIndex: 'keys',
      key: 'keys',
      width: 120,
      render: (keys: string) => (
        <Text code style={{ fontSize: '12px' }}>{keys}</Text>
      )
    },
    {
      title: '功能描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '使用场景',
      dataIndex: 'context',
      key: 'context',
      width: 120,
      render: (context: string) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>{context}</Text>
      )
    }
  ];

  return (
    <>
      <Button
        type="text"
        icon={<KeyOutlined />}
        onClick={() => setVisible(true)}
        title="查看快捷键帮助"
        style={{ color: '#1890ff' }}
      >
        快捷键
      </Button>

      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#1890ff' }} />
            <span>快捷键帮助</span>
          </Space>
        }
        open={visible}
        onCancel={() => setVisible(false)}
        footer={[
          <Button key="close" onClick={() => setVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">
            使用快捷键可以大大提高操作效率。以下是所有可用的快捷键：
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={shortcuts}
          pagination={false}
          size="small"
          bordered
        />

        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px' }}>
          <Text style={{ fontSize: '12px' }}>
            💡 <strong>提示：</strong>在Mac系统中，请使用 Cmd 键替代 Ctrl 键。
          </Text>
        </div>
      </Modal>
    </>
  );
};

export default KeyboardShortcuts;