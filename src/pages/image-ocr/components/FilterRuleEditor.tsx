import React, { useState, useEffect, useCallback } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Switch, 
  Button, 
  Alert, 
  Space,
  Typography,
  Divider
} from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { TextFilterRule } from '../../../types/config';
import { validateRegexPattern } from '../../../utils/textFilter';

const { TextArea } = Input;
const { Text } = Typography;

interface FilterRuleEditorProps {
  visible: boolean;
  rule: TextFilterRule | null;
  onSave: (rule: TextFilterRule) => void;
  onCancel: () => void;
}

export const FilterRuleEditor: React.FC<FilterRuleEditorProps> = ({
  visible,
  rule,
  onSave,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [patternValidation, setPatternValidation] = useState<{ isValid: boolean; error?: string }>({ isValid: true });
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<{ matches: string[]; filteredText: string } | null>(null);

  // 当规则变化时重置表单
  useEffect(() => {
    if (visible && rule) {
      form.setFieldsValue({
        name: rule.name,
        pattern: rule.pattern,
        enabled: rule.enabled,
        description: rule.description || ''
      });
      setTestText('');
      setTestResult(null);
      validatePattern(rule.pattern);
    } else if (visible) {
      form.resetFields();
      setTestText('');
      setTestResult(null);
      setPatternValidation({ isValid: true });
    }
  }, [visible, rule, form]);

  // 验证正则表达式
  const validatePattern = useCallback((pattern: string) => {
    const validation = validateRegexPattern(pattern);
    setPatternValidation(validation);
    return validation.isValid;
  }, []);

  // 处理正则表达式输入变化
  const handlePatternChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pattern = e.target.value;
    validatePattern(pattern);
    
    // 如果有测试文本，实时更新测试结果
    if (testText && pattern) {
      testPattern(pattern, testText);
    }
  }, [testText, validatePattern]);

  // 测试正则表达式
  const testPattern = useCallback((pattern: string, text: string) => {
    if (!pattern || !text) {
      setTestResult(null);
      return;
    }

    try {
      const regex = new RegExp(pattern, 'g');
      const matches = text.match(regex) || [];
      const filteredText = text.replace(regex, '');
      
      setTestResult({
        matches,
        filteredText
      });
    } catch (error) {
      setTestResult(null);
    }
  }, []);

  // 处理测试文本变化
  const handleTestTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setTestText(text);
    
    const pattern = form.getFieldValue('pattern');
    if (pattern) {
      testPattern(pattern, text);
    }
  }, [form, testPattern]);

  // 保存规则
  const handleSave = useCallback(() => {
    form.validateFields().then(values => {
      if (!patternValidation.isValid) {
        return;
      }

      const savedRule: TextFilterRule = {
        id: rule?.id || `rule_${Date.now()}`,
        name: values.name,
        pattern: values.pattern,
        enabled: values.enabled,
        description: values.description
      };

      onSave(savedRule);
    });
  }, [form, rule, patternValidation.isValid, onSave]);

  // 快速插入常用正则表达式
  const insertCommonPattern = useCallback((pattern: string, description: string) => {
    form.setFieldsValue({ pattern });
    validatePattern(pattern);
    
    if (testText) {
      testPattern(pattern, testText);
    }
  }, [form, testText, validatePattern, testPattern]);

  const commonPatterns = [
    { pattern: '\\d+', description: '数字' },
    { pattern: '[a-zA-Z]+', description: '英文字母' },
    { pattern: '\\s+', description: '空白字符' },
    { pattern: '[\\u4e00-\\u9fa5]+', description: '中文字符' },
    { pattern: '\\b\\w+@\\w+\\.\\w+\\b', description: '邮箱地址' },
    { pattern: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b', description: 'IP地址' }
  ];

  return (
    <Modal
      title={rule?.id ? '编辑过滤规则' : '添加过滤规则'}
      open={visible}
      onCancel={onCancel}
      width={700}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button 
            type="primary" 
            onClick={handleSave}
            disabled={!patternValidation.isValid}
            icon={<CheckCircleOutlined />}
          >
            保存规则
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enabled: true,
          name: '',
          pattern: '',
          description: ''
        }}
      >
        <Form.Item
          label="规则名称"
          name="name"
          rules={[{ required: true, message: '请输入规则名称' }]}
        >
          <Input placeholder="请输入规则名称，如：移除数字、过滤邮箱等" />
        </Form.Item>

        <Form.Item
          label="正则表达式"
          name="pattern"
          rules={[{ required: true, message: '请输入正则表达式' }]}
        >
          <Input
            placeholder="请输入正则表达式，如：\\d+ 匹配数字"
            onChange={handlePatternChange}
          />
        </Form.Item>

        {/* 正则表达式验证结果 */}
        {!patternValidation.isValid && (
          <Alert
            type="error"
            message="正则表达式语法错误"
            description={patternValidation.error}
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        {/* 常用正则表达式快捷插入 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: '13px', marginBottom: 8, display: 'block' }}>
            常用正则表达式：
          </Text>
          <Space wrap>
            {commonPatterns.map((item, index) => (
              <Button
                key={index}
                size="small"
                type="dashed"
                onClick={() => insertCommonPattern(item.pattern, item.description)}
                title={`插入: ${item.pattern}`}
              >
                {item.description}
              </Button>
            ))}
          </Space>
        </div>

        <Form.Item
          label="规则描述"
          name="description"
        >
          <TextArea
            rows={2}
            placeholder="可选：描述此规则的用途，如：移除文本中的所有数字"
          />
        </Form.Item>

        <Form.Item
          label="启用规则"
          name="enabled"
          valuePropName="checked"
        >
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>

        <Divider orientation="left" style={{ fontSize: '13px' }}>实时测试</Divider>

        {/* 测试区域 */}
        <div style={{ background: '#fafafa', padding: 16, borderRadius: 6 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: '13px' }}>测试文本：</Text>
            <TextArea
              value={testText}
              onChange={handleTestTextChange}
              placeholder="输入测试文本，查看过滤效果..."
              rows={3}
              style={{ marginTop: 4 }}
            />
          </div>

          {testResult && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: '13px' }}>匹配结果：</Text>
                <div style={{ 
                  background: '#fff', 
                  padding: 8, 
                  borderRadius: 4, 
                  border: '1px solid #d9d9d9',
                  marginTop: 4,
                  minHeight: 32
                }}>
                  {testResult.matches.length > 0 ? (
                    <Space wrap>
                      {testResult.matches.map((match, index) => (
                        <span
                          key={index}
                          style={{
                            background: '#ff4d4f',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: 3,
                            fontSize: '12px'
                          }}
                        >
                          {match}
                        </span>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary" style={{ fontSize: '12px' }}>无匹配内容</Text>
                  )}
                </div>
              </div>

              <div>
                <Text strong style={{ fontSize: '13px' }}>过滤后文本：</Text>
                <div style={{ 
                  background: '#fff', 
                  padding: 8, 
                  borderRadius: 4, 
                  border: '1px solid #d9d9d9',
                  marginTop: 4,
                  minHeight: 32,
                  whiteSpace: 'pre-wrap'
                }}>
                  <Text style={{ fontSize: '12px' }}>
                    {testResult.filteredText || <span style={{ color: '#999' }}>(空)</span>}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </div>
      </Form>
    </Modal>
  );
};