import React from 'react';
import { Card, Radio, Typography, Space, Alert } from 'antd';
import { TranslationOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange
}) => {
  const languageOptions = [
    {
      value: 'chi_sim',
      label: '仅中文',
      description: '专门识别中文，速度更快，准确率更高',
      icon: '🇨🇳',
      recommended: true
    },
    {
      value: 'eng',
      label: '仅英文',
      description: '专门识别英文和数字',
      icon: '🇺🇸',
      recommended: false
    },
    {
      value: 'chi_sim+eng',
      label: '中英混合',
      description: '同时识别中文和英文，速度较慢',
      icon: '🌐',
      recommended: false
    }
  ];

  return (
    <Card 
      title={
        <Space>
          <TranslationOutlined />
          <span>识别语言设置</span>
        </Space>
      } 
      size="small"
      style={{ marginBottom: '16px' }}
    >
      <Radio.Group 
        value={selectedLanguage} 
        onChange={(e) => onLanguageChange(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {languageOptions.map(option => (
            <Radio key={option.value} value={option.value} style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  <span style={{ fontSize: '16px' }}>{option.icon}</span>
                  <Text strong>{option.label}</Text>
                  {option.recommended && (
                    <Text type="success" style={{ fontSize: '12px' }}>
                      <ThunderboltOutlined /> 推荐
                    </Text>
                  )}
                </Space>
              </div>
              <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {option.description}
                </Text>
              </div>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
      
      {selectedLanguage === 'chi_sim' && (
        <Alert
          message="中文优化模式已启用"
          description="已启用专门的中文识别优化，包括降低并发数、优化识别参数、增强文本清理等，预期识别速度和准确率都会显著提升。"
          type="success"
          showIcon
          style={{ marginTop: '12px' }}
        />
      )}
      
      {selectedLanguage === 'chi_sim+eng' && (
        <Alert
          message="性能提示"
          description="中英混合模式需要加载多个语言模型，会增加内存占用和处理时间。如果主要识别中文，建议选择'仅中文'模式。"
          type="warning"
          showIcon
          style={{ marginTop: '12px' }}
        />
      )}
    </Card>
  );
};

export default LanguageSelector;