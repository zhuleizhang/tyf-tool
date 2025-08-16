import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  message, 
  Progress,
  Popconfirm,
  Typography,
  Collapse,
  Statistic,
  Row,
  Col,
  Tooltip,
  Alert,
  Spin
} from 'antd';
import { 
  UploadOutlined, 
  DeleteOutlined, 
  ExportOutlined, 
  ClearOutlined,
  EyeOutlined,
  StopOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import ImageUpload from './components/ImageUpload';
import ImageTable from './components/ImageTable';
import ExportButton from './components/ExportButton';
import ExportFeatures from './components/ExportFeatures';
import PerformanceMonitor from './components/PerformanceMonitor';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import { useImageOCR } from './hooks/useImageOCR';
import { useImageManager } from './hooks/useImageManager';

const { Title, Text } = Typography;
const { Panel } = Collapse;

export interface ImageData {
  id: string;
  file: File;
  url: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
  confidence?: number;
}

const ImageOCR: React.FC = () => {
  const [showStats, setShowStats] = useState(false);
  const [lastActivity, setLastActivity] = useState<string>('');

  const {
    images,
    addImages,
    removeImage,
    clearImages,
    updateImageText,
    reorderImages,
    getStats
  } = useImageManager();

  const {
    recognizeImage,
    recognizeAll,
    cancelRecognition,
    resetOCRWorker,
    clearCache,
    isProcessing,
    progress,
    currentProcessing,
    pendingCount,
    ocrStats
  } = useImageOCR(images, updateImageText);

  // 计算统计信息
  const stats = useMemo(() => getStats(), [getStats]);

  // 快捷键支持
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + U: 上传图片
      if ((event.ctrlKey || event.metaKey) && event.key === 'u') {
        event.preventDefault();
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fileInput?.click();
        setLastActivity('快捷键上传图片');
      }
      
      // Ctrl/Cmd + R: 批量识别
      if ((event.ctrlKey || event.metaKey) && event.key === 'r' && !isProcessing) {
        event.preventDefault();
        handleRecognizeAll();
        setLastActivity('快捷键批量识别');
      }
      
      // Ctrl/Cmd + E: 导出Excel
      if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        // 触发导出功能
        if (images.length > 0) {
          // 这里可以调用导出函数，暂时只显示提示
          message.info('请点击导出Excel按钮进行导出');
        }
        setLastActivity('快捷键导出Excel');
      }
      
      // Escape: 取消识别
      if (event.key === 'Escape' && isProcessing) {
        event.preventDefault();
        handleCancelRecognition();
        setLastActivity('快捷键取消识别');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isProcessing]);

  const handleImageUpload = useCallback((files: File[]) => {
    addImages(files);
    setLastActivity(`上传了 ${files.length} 张图片`);
  }, [addImages]);

  const handleRecognizeAll = useCallback(async () => {
    if (images.length === 0) {
      message.warning('请先上传图片');
      return;
    }
    
    if (pendingCount === 0) {
      message.info('所有图片已完成识别');
      return;
    }
    
    try {
      setLastActivity(`开始批量识别 ${pendingCount} 张图片`);
      await recognizeAll();
      setLastActivity('批量识别完成');
    } catch (error) {
      setLastActivity('批量识别失败');
      console.error('Batch recognition error:', error);
    }
  }, [images.length, pendingCount, recognizeAll]);

  const handleRecognizeSingle = useCallback(async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    try {
      setLastActivity(`识别图片: ${image?.file.name}`);
      await recognizeImage(imageId);
      setLastActivity(`图片识别完成: ${image?.file.name}`);
    } catch (error) {
      setLastActivity(`图片识别失败: ${image?.file.name}`);
      console.error('Single recognition error:', error);
    }
  }, [recognizeImage, images]);

  const handleCancelRecognition = useCallback(() => {
    cancelRecognition();
    setLastActivity('已取消识别操作');
  }, [cancelRecognition]);

  const handleResetOCR = useCallback(async () => {
    try {
      await resetOCRWorker();
      setLastActivity('OCR引擎已重置');
    } catch (error) {
      setLastActivity('OCR引擎重置失败');
    }
  }, [resetOCRWorker]);

  const handleClearCache = useCallback(() => {
    clearCache();
    setLastActivity('OCR缓存已清理');
  }, [clearCache]);

  const handleClearAll = useCallback(() => {
    clearImages();
    setLastActivity('已清空所有数据');
  }, [clearImages]);

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={4}>
                图片文字识别
                <Tooltip title="支持快捷键操作，点击右侧按钮查看详情">
                  <InfoCircleOutlined style={{ marginLeft: '8px', fontSize: '16px', color: '#1890ff' }} />
                </Tooltip>
              </Title>
              <Text type="secondary">
                支持上传多张图片，自动识别图片中的文字内容，并导出为Excel文件
              </Text>
              {lastActivity && (
                <div style={{ marginTop: '8px' }}>
                  <Text type="success" style={{ fontSize: '12px' }}>
                    <ClockCircleOutlined /> 最近操作：{lastActivity}
                  </Text>
                </div>
              )}
            </div>
            <KeyboardShortcuts />
          </div>
        </div>

        {/* 统计信息面板 */}
        {images.length > 0 && (
          <Card 
            title={
              <Space>
                <span>统计信息</span>
                <Button 
                  type="link" 
                  size="small"
                  onClick={() => setShowStats(!showStats)}
                >
                  {showStats ? '收起' : '展开'}
                </Button>
              </Space>
            }
            size="small" 
            style={{ marginBottom: '16px' }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Statistic 
                  title="总图片数" 
                  value={stats.total} 
                  prefix={<UploadOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="已完成" 
                  value={stats.completed} 
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="待识别" 
                  value={pendingCount} 
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="识别失败" 
                  value={stats.error} 
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
            </Row>
            
            {showStats && (
              <Row gutter={16} style={{ marginTop: '16px' }}>
                <Col span={6}>
                  <Statistic 
                    title="总文件大小" 
                    value={(stats.totalSize / 1024 / 1024).toFixed(1)} 
                    suffix="MB"
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="平均置信度" 
                    value={stats.avgConfidence.toFixed(1)} 
                    suffix="%"
                    valueStyle={{ color: stats.avgConfidence > 80 ? '#3f8600' : '#faad14' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="已处理数量" 
                    value={ocrStats.totalProcessed}
                    prefix={<ThunderboltOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="平均处理时间" 
                    value={ocrStats.totalProcessed > 0 ? (ocrStats.totalTime / ocrStats.totalProcessed / 1000).toFixed(1) : '0'} 
                    suffix="秒"
                  />
                </Col>
              </Row>
            )}
          </Card>
        )}

        {/* 图片上传区域 */}
        <Card 
          title="图片上传" 
          size="small" 
          style={{ marginBottom: '16px' }}
        >
          <ImageUpload onUpload={handleImageUpload} />
        </Card>

        {/* 操作按钮区域 */}
        <Card 
          title="批量操作" 
          size="small" 
          style={{ marginBottom: '16px' }}
        >
          <Space wrap>
            {!isProcessing ? (
              <Button
                type="primary"
                icon={<EyeOutlined />}
                onClick={handleRecognizeAll}
                disabled={images.length === 0 || pendingCount === 0}
              >
                批量识别 {pendingCount > 0 && `(${pendingCount}张)`}
              </Button>
            ) : (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleCancelRecognition}
              >
                取消识别
              </Button>
            )}
            
            <ExportButton images={images} />
            
            <Button
              icon={<ReloadOutlined />}
              onClick={handleResetOCR}
              title="重置OCR引擎"
            >
              重置OCR
            </Button>

            <Button
              icon={<DeleteOutlined />}
              onClick={handleClearCache}
              title="清理OCR缓存"
            >
              清理缓存
            </Button>
            
            <Popconfirm
              title="确定要清空所有数据吗？"
              onConfirm={handleClearAll}
              okText="确定"
              cancelText="取消"
            >
              <Button
                icon={<ClearOutlined />}
                disabled={images.length === 0}
              >
                清空数据
              </Button>
            </Popconfirm>
          </Space>
          
          {isProcessing && (
            <div style={{ marginTop: '16px' }}>
              <Alert
                message="正在进行OCR识别"
                description={
                  <div>
                    <Progress 
                      percent={Math.round(progress)} 
                      status="active"
                      format={(percent) => `${percent}% 识别中...`}
                      strokeColor={{
                        '0%': '#108ee9',
                        '100%': '#87d068',
                      }}
                    />
                    {currentProcessing && (
                      <div style={{ marginTop: '8px', fontSize: '12px' }}>
                        <Spin size="small" style={{ marginRight: '8px' }} />
                        正在处理: {currentProcessing.split('/').pop()}
                      </div>
                    )}
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                      提示：可以按 Esc 键取消识别
                    </div>
                  </div>
                }
                type="info"
                showIcon
              />
            </div>
          )}
        </Card>

        {/* 性能监控 */}
        {(isProcessing || ocrStats.totalProcessed > 0) && (
          <PerformanceMonitor
            isProcessing={isProcessing}
            ocrStats={ocrStats}
            imageCount={images.length}
          />
        )}

        {/* 性能提示 */}
        {images.length > 20 && (
          <Alert
            message="性能提示"
            description="当前图片数量较多，建议分批处理以获得更好的性能表现。"
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* 导出功能说明 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Collapse ghost>
            <Panel 
              header={
                <Space>
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  <Text strong>Excel导出功能说明</Text>
                  <Text type="secondary">（点击查看详细功能特性）</Text>
                </Space>
              } 
              key="export-features"
            >
              <ExportFeatures />
            </Panel>
          </Collapse>
        </Card>

        {/* 图片列表区域 */}
        <Card 
          title={
            <Space>
              <span>图片列表</span>
              <Text type="secondary">({images.length}张)</Text>
              {stats.completed > 0 && (
                <Text type="success">
                  已完成 {stats.completed}/{images.length}
                </Text>
              )}
            </Space>
          } 
          size="small"
        >
          {images.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <UploadOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <div>暂无图片，请先上传图片</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                支持拖拽上传或点击上传按钮，快捷键：Ctrl+U
              </div>
            </div>
          ) : (
            <ImageTable
              images={images}
              onRemove={removeImage}
              onRecognize={handleRecognizeSingle}
              onUpdateText={updateImageText}
              onReorder={reorderImages}
            />
          )}
        </Card>
      </Card>
    </div>
  );
};

export default ImageOCR;