import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, Typography, Space } from 'antd';
import { 
  ThunderboltOutlined, 
  ClockCircleOutlined, 
  DatabaseOutlined,
  DashboardOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface PerformanceMonitorProps {
  isProcessing: boolean;
  ocrStats: {
    totalProcessed: number;
    totalTime: number;
    avgConfidence: number;
  };
  imageCount: number;
}

interface SystemStats {
  memoryUsage: number;
  cpuUsage: number;
  processingSpeed: number;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isProcessing,
  ocrStats,
  imageCount
}) => {
  const [systemStats, setSystemStats] = useState<SystemStats>({
    memoryUsage: 0,
    cpuUsage: 0,
    processingSpeed: 0
  });

  // 模拟系统性能监控
  useEffect(() => {
    const interval = setInterval(() => {
      // 模拟内存使用情况
      const baseMemory = Math.min(imageCount * 2, 50); // 基础内存使用
      const processingMemory = isProcessing ? 20 : 0; // 处理时额外内存
      const memoryUsage = baseMemory + processingMemory + Math.random() * 10;

      // 模拟CPU使用情况
      const cpuUsage = isProcessing ? 60 + Math.random() * 30 : 5 + Math.random() * 10;

      // 计算处理速度
      const processingSpeed = ocrStats.totalProcessed > 0 
        ? (ocrStats.totalProcessed / (ocrStats.totalTime / 1000 / 60)) // 张/分钟
        : 0;

      setSystemStats({
        memoryUsage: Math.min(memoryUsage, 100),
        cpuUsage: Math.min(cpuUsage, 100),
        processingSpeed
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isProcessing, imageCount, ocrStats]);

  const getMemoryColor = (usage: number) => {
    if (usage > 80) return '#ff4d4f';
    if (usage > 60) return '#faad14';
    return '#52c41a';
  };

  const getCpuColor = (usage: number) => {
    if (usage > 80) return '#ff4d4f';
    if (usage > 60) return '#faad14';
    return '#52c41a';
  };

  return (
    <Card 
      title={
        <Space>
          <DashboardOutlined />
          <span>性能监控</span>
        </Space>
      }
      size="small"
    >
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="处理速度"
            value={systemStats.processingSpeed.toFixed(1)}
            suffix="张/分钟"
            prefix={<ThunderboltOutlined />}
            valueStyle={{ 
              color: systemStats.processingSpeed > 5 ? '#3f8600' : '#1890ff' 
            }}
          />
        </Col>
        
        <Col span={6}>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>内存使用</Text>
            <div style={{ marginTop: '4px' }}>
              <Progress
                percent={systemStats.memoryUsage}
                size="small"
                strokeColor={getMemoryColor(systemStats.memoryUsage)}
                format={(percent) => `${percent?.toFixed(0)}%`}
              />
            </div>
          </div>
        </Col>
        
        <Col span={6}>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>CPU使用</Text>
            <div style={{ marginTop: '4px' }}>
              <Progress
                percent={systemStats.cpuUsage}
                size="small"
                strokeColor={getCpuColor(systemStats.cpuUsage)}
                format={(percent) => `${percent?.toFixed(0)}%`}
              />
            </div>
          </div>
        </Col>
        
        <Col span={6}>
          <Statistic
            title="平均耗时"
            value={
              ocrStats.totalProcessed > 0 
                ? (ocrStats.totalTime / ocrStats.totalProcessed / 1000).toFixed(1)
                : '0'
            }
            suffix="秒/张"
            prefix={<ClockCircleOutlined />}
            valueStyle={{ fontSize: '16px' }}
          />
        </Col>
      </Row>

      {/* 性能提示 */}
      {systemStats.memoryUsage > 80 && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#fff2f0', 
          border: '1px solid #ffccc7',
          borderRadius: '4px'
        }}>
          <Text type="danger" style={{ fontSize: '12px' }}>
            ⚠️ 内存使用率较高，建议减少并发处理数量或重启应用
          </Text>
        </div>
      )}

      {systemStats.cpuUsage > 80 && (
        <div style={{ 
          marginTop: '8px', 
          padding: '8px', 
          backgroundColor: '#fffbe6', 
          border: '1px solid #ffe58f',
          borderRadius: '4px'
        }}>
          <Text type="warning" style={{ fontSize: '12px' }}>
            ⚠️ CPU使用率较高，处理速度可能受到影响
          </Text>
        </div>
      )}

      {systemStats.processingSpeed > 0 && systemStats.processingSpeed < 2 && (
        <div style={{ 
          marginTop: '8px', 
          padding: '8px', 
          backgroundColor: '#e6f7ff', 
          border: '1px solid #91d5ff',
          borderRadius: '4px'
        }}>
          <Text style={{ fontSize: '12px', color: '#1890ff' }}>
            💡 处理速度较慢，建议检查图片大小和格式
          </Text>
        </div>
      )}
    </Card>
  );
};

export default PerformanceMonitor;