import React, { useState, useCallback } from 'react';
import { 
  Card, 
  Switch, 
  Button, 
  Space, 
  Typography, 
  Collapse, 
  message,
  Empty,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  SettingOutlined, 
  FilterOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { TextFilterRule } from '../../../types/config';
import { useImageOcrConfig } from '../../../hooks/useGlobalConfig';
import { generateRuleId } from '../../../utils/textFilter';
import { FilterRuleEditor } from './FilterRuleEditor';
import { FilterTestPanel } from './FilterTestPanel';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface TextFilterSettingsProps {
  onFilterChange?: (enabled: boolean, rules: TextFilterRule[]) => void;
}

export const TextFilterSettings: React.FC<TextFilterSettingsProps> = ({
  onFilterChange
}) => {
  const [config, updateConfig] = useImageOcrConfig();
  const [editingRule, setEditingRule] = useState<TextFilterRule | null>(null);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [isTestPanelVisible, setIsTestPanelVisible] = useState(false);

  const { enabled, rules } = config.textFilter;

  // 切换过滤功能开关
  const handleToggleEnabled = useCallback(async (checked: boolean) => {
    try {
      const newConfig = {
        ...config,
        textFilter: {
          ...config.textFilter,
          enabled: checked
        }
      };
      await updateConfig(newConfig);
      onFilterChange?.(checked, rules);
      message.success(checked ? '文字过滤已启用' : '文字过滤已禁用');
    } catch (error) {
      console.error('切换过滤开关失败:', error);
      message.error('操作失败');
    }
  }, [config, updateConfig, rules, onFilterChange]);

  // 添加新规则
  const handleAddRule = useCallback(() => {
    const newRule: TextFilterRule = {
      id: generateRuleId(),
      name: '新规则',
      pattern: '',
      enabled: true,
      description: ''
    };
    setEditingRule(newRule);
    setIsEditorVisible(true);
  }, []);

  // 编辑规则
  const handleEditRule = useCallback((rule: TextFilterRule) => {
    setEditingRule(rule);
    setIsEditorVisible(true);
  }, []);

  // 保存规则
  const handleSaveRule = useCallback(async (rule: TextFilterRule) => {
    try {
      let newRules: TextFilterRule[];
      
      if (rules.find(r => r.id === rule.id)) {
        // 更新现有规则
        newRules = rules.map(r => r.id === rule.id ? rule : r);
      } else {
        // 添加新规则
        newRules = [...rules, rule];
      }

      const newConfig = {
        ...config,
        textFilter: {
          ...config.textFilter,
          rules: newRules
        }
      };

      await updateConfig(newConfig);
      onFilterChange?.(enabled, newRules);
      setIsEditorVisible(false);
      setEditingRule(null);
      message.success('规则保存成功');
    } catch (error) {
      console.error('保存规则失败:', error);
      message.error('保存规则失败');
    }
  }, [config, updateConfig, rules, enabled, onFilterChange]);

  // 删除规则
  const handleDeleteRule = useCallback(async (ruleId: string) => {
    try {
      const newRules = rules.filter(r => r.id !== ruleId);
      const newConfig = {
        ...config,
        textFilter: {
          ...config.textFilter,
          rules: newRules
        }
      };

      await updateConfig(newConfig);
      onFilterChange?.(enabled, newRules);
      message.success('规则删除成功');
    } catch (error) {
      console.error('删除规则失败:', error);
      message.error('删除规则失败');
    }
  }, [config, updateConfig, rules, enabled, onFilterChange]);

  // 切换规则启用状态
  const handleToggleRule = useCallback(async (ruleId: string, ruleEnabled: boolean) => {
    try {
      const newRules = rules.map(r => 
        r.id === ruleId ? { ...r, enabled: ruleEnabled } : r
      );
      
      const newConfig = {
        ...config,
        textFilter: {
          ...config.textFilter,
          rules: newRules
        }
      };

      await updateConfig(newConfig);
      onFilterChange?.(enabled, newRules);
    } catch (error) {
      console.error('切换规则状态失败:', error);
      message.error('操作失败');
    }
  }, [config, updateConfig, rules, enabled, onFilterChange]);

  const enabledRulesCount = rules.filter(r => r.enabled).length;

  return (
    <div>
      <Collapse ghost>
        <Panel
          header={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SettingOutlined />
              <span>高级设置 - 文字过滤</span>
              {enabled && (
                <span style={{ 
                  fontSize: '12px', 
                  color: '#52c41a',
                  background: '#f6ffed',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #b7eb8f'
                }}>
                  已启用 ({enabledRulesCount}/{rules.length})
                </span>
              )}
            </div>
          }
          key="text-filter"
        >
          <Card size="small">
            {/* 功能开关 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FilterOutlined />
                    文字过滤功能
                  </Title>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    启用后将根据设定的正则表达式规则过滤识别出的文字内容
                  </Text>
                </div>
                <Switch
                  checked={enabled}
                  onChange={handleToggleEnabled}
                  checkedChildren="启用"
                  unCheckedChildren="禁用"
                />
              </div>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* 操作按钮 */}
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddRule}
                  size="small"
                >
                  添加规则
                </Button>
                <Button
                  icon={<ExperimentOutlined />}
                  onClick={() => setIsTestPanelVisible(true)}
                  size="small"
                  disabled={rules.length === 0}
                >
                  测试过滤效果
                </Button>
              </Space>
            </div>

            {/* 规则列表 */}
            {rules.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无过滤规则"
                style={{ margin: '20px 0' }}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule}>
                  添加第一个规则
                </Button>
              </Empty>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {rules.map((rule, index) => (
                  <Card
                    key={rule.id}
                    size="small"
                    style={{ marginBottom: 8 }}
                    bodyStyle={{ padding: '12px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Switch
                            size="small"
                            checked={rule.enabled}
                            onChange={(checked) => handleToggleRule(rule.id, checked)}
                          />
                          <Text strong style={{ fontSize: '13px' }}>
                            {rule.name}
                          </Text>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
                          正则: <code style={{ background: '#f5f5f5', padding: '2px 4px', borderRadius: '2px' }}>
                            {rule.pattern || '(未设置)'}
                          </code>
                        </div>
                        {rule.description && (
                          <div style={{ fontSize: '11px', color: '#999' }}>
                            {rule.description}
                          </div>
                        )}
                      </div>
                      <Space>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleEditRule(rule)}
                        >
                          编辑
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          danger
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          删除
                        </Button>
                      </Space>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Panel>
      </Collapse>

      {/* 规则编辑器 */}
      <FilterRuleEditor
        visible={isEditorVisible}
        rule={editingRule}
        onSave={handleSaveRule}
        onCancel={() => {
          setIsEditorVisible(false);
          setEditingRule(null);
        }}
      />

      {/* 测试面板 */}
      <FilterTestPanel
        visible={isTestPanelVisible}
        rules={rules}
        onClose={() => setIsTestPanelVisible(false)}
      />
    </div>
  );
};