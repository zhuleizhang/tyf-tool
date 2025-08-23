import React, { useState, useCallback, useMemo } from 'react';
import { 
  Modal, 
  Input, 
  Card, 
  Typography, 
  Space, 
  Tag, 
  Divider,
  Button,
  Empty,
  Alert
} from 'antd';
import { ExperimentOutlined, ClearOutlined } from '@ant-design/icons';
import { TextFilterRule } from '../../../types/config';
import { createTextFilter } from '../../../utils/textFilter';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface FilterTestPanelProps {
  visible: boolean;
  rules: TextFilterRule[];
  onClose: () => void;
}

export const FilterTestPanel: React.FC<FilterTestPanelProps> = ({
  visible,
  rules,
  onClose
}) => {
  const [testText, setTestText] = useState('');

  // 创建文字过滤器实例
  const textFilter = useMemo(() => {
    return createTextFilter(rules);
  }, [rules]);

  // 获取测试结果
  const testResult = useMemo(() => {
    if (!testText.trim()) {
      return null;
    }
    return textFilter.testAllRules(testText);
  }, [textFilter, testText]);

  // 清空测试文本
  const handleClearText = useCallback(() => {
    setTestText('');
  }, []);

  // 插入示例文本
  const insertSampleText = useCallback(() => {
    const sampleText = `这是一段测试文本，包含各种内容：
数字：12345，电话：138-0013-8000
邮箱：test@example.com，网址：https://www.example.com
中文：你好世界，English：Hello World
特殊字符：@#$%^&*()，空格和换行符
IP地址：192.168.1.1，时间：2023-12-25 14:30:00`;
    setTestText(sampleText);
  }, []);

  const enabledRules = rules.filter(rule => rule.enabled);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExperimentOutlined />
          <span>过滤效果测试</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* 规则状态显示 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong>当前启用规则：</Text>
          {enabledRules.length === 0 ? (
            <Text type="secondary" style={{ marginLeft: 8 }}>无启用规则</Text>
          ) : (
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                {enabledRules.map(rule => (
                  <Tag key={rule.id} color="blue">
                    {rule.name}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </div>

        <Divider />

        {/* 测试输入区域 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>测试文本：</Text>
            <Space>
              <Button size="small" onClick={insertSampleText}>
                插入示例文本
              </Button>
              <Button 
                size="small" 
                icon={<ClearOutlined />} 
                onClick={handleClearText}
                disabled={!testText}
              >
                清空
              </Button>
            </Space>
          </div>
          <TextArea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="输入要测试的文本内容..."
            rows={6}
            style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
          />
        </div>

        {/* 测试结果显示 */}
        {testText.trim() ? (
          enabledRules.length === 0 ? (
            <Alert
              type="warning"
              message="无启用的规则"
              description="请先启用至少一个过滤规则"
              showIcon
            />
          ) : testResult ? (
            <div>
              <Title level={5}>过滤结果：</Title>
              
              {/* 每个规则的匹配结果 */}
              {testResult.ruleResults.map((result, index) => (
                <Card
                  key={result.ruleId}
                  size="small"
                  style={{ marginBottom: 12 }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>规则 {index + 1}: {result.ruleName}</span>
                      <Tag color={result.matchCount > 0 ? 'red' : 'green'}>
                        {result.matchCount > 0 ? `匹配 ${result.matchCount} 项` : '无匹配'}
                      </Tag>
                    </div>
                  }
                >
                  {result.matchCount > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ fontSize: '12px' }}>匹配内容：</Text>
                      <div style={{ marginTop: 4 }}>
                        <Space wrap>
                          {result.matches.map((match, matchIndex) => (
                            <Tag key={matchIndex} color="red" style={{ fontSize: '11px' }}>
                              {match}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              <Divider />

              {/* 最终结果对比 */}
              <div>
                <Title level={5}>最终对比：</Title>
                
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: '13px' }}>原始文本：</Text>
                  <div style={{ 
                    background: '#f5f5f5', 
                    padding: 12, 
                    borderRadius: 6, 
                    marginTop: 4,
                    border: '1px solid #d9d9d9',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                    fontSize: '12px'
                  }}>
                    {testResult.originalText}
                  </div>
                </div>

                <div>
                  <Text strong style={{ fontSize: '13px' }}>过滤后文本：</Text>
                  <div style={{ 
                    background: testResult.filteredText !== testResult.originalText ? '#f6ffed' : '#f5f5f5', 
                    padding: 12, 
                    borderRadius: 6, 
                    marginTop: 4,
                    border: `1px solid ${testResult.filteredText !== testResult.originalText ? '#b7eb8f' : '#d9d9d9'}`,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                    fontSize: '12px',
                    minHeight: 40
                  }}>
                    {testResult.filteredText || <Text type="secondary">(空文本)</Text>}
                  </div>
                </div>

                {/* 统计信息 */}
                <div style={{ marginTop: 12, padding: 8, background: '#fafafa', borderRadius: 4 }}>
                  <Space split={<Divider type="vertical" />}>
                    <Text style={{ fontSize: '12px' }}>
                      原始长度: {testResult.originalText.length}
                    </Text>
                    <Text style={{ fontSize: '12px' }}>
                      过滤后长度: {testResult.filteredText.length}
                    </Text>
                    <Text style={{ fontSize: '12px' }}>
                      移除字符: {testResult.originalText.length - testResult.filteredText.length}
                    </Text>
                    <Text style={{ fontSize: '12px' }}>
                      总匹配项: {testResult.ruleResults.reduce((sum, r) => sum + r.matchCount, 0)}
                    </Text>
                  </Space>
                </div>
              </div>
            </div>
          ) : null
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="请输入测试文本"
            style={{ margin: '40px 0' }}
          />
        )}
      </div>
    </Modal>
  );
};