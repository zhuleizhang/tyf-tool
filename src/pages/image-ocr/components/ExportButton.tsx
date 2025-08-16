import React, { useState, useCallback, useEffect } from 'react';
import { Button, message, Modal, Progress, Typography } from 'antd';
import { ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ImageData } from '../index';

const { Text } = Typography;

interface ExportButtonProps {
  images: ImageData[];
}

interface ExportProgress {
  progress: number;
  status: 'starting' | 'processing' | 'completed' | 'error';
  message: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ images }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    progress: 0,
    status: 'starting',
    message: ''
  });
  const [showProgress, setShowProgress] = useState(false);

  // 监听导出进度
  useEffect(() => {
    const handleExportProgress = (event: any, progressData: ExportProgress) => {
      setExportProgress(progressData);
      
      if (progressData.status === 'completed') {
        setTimeout(() => {
          setShowProgress(false);
          setIsExporting(false);
          message.success('Excel导出成功！');
        }, 1000);
      } else if (progressData.status === 'error') {
        setShowProgress(false);
        setIsExporting(false);
        message.error(`导出失败：${progressData.message}`);
      }
    };

    // 添加事件监听器
    if (window.electronAPI?.on) {
      window.electronAPI.on('export-progress', handleExportProgress);
    }

    // 清理函数
    return () => {
      if (window.electronAPI?.removeListener) {
        window.electronAPI.removeListener('export-progress', handleExportProgress);
      }
    };
  }, []);

  const handleExport = useCallback(async () => {
    if (images.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }

    const completedImages = images.filter(img => img.status === 'completed' && img.text);
    
    if (completedImages.length === 0) {
      Modal.confirm({
        title: '导出确认',
        content: '当前没有已完成识别的图片，是否导出所有图片（识别结果为空）？',
        onOk: () => performExport(images),
      });
      return;
    }

    if (completedImages.length < images.length) {
      Modal.confirm({
        title: '导出确认',
        content: `共有 ${images.length} 张图片，其中 ${completedImages.length} 张已完成识别。是否导出所有图片？`,
        onOk: () => performExport(images),
      });
      return;
    }

    await performExport(images);
  }, [images]);

  const performExport = async (imagesToExport: ImageData[]) => {
    setIsExporting(true);
    setShowProgress(true);
    setExportProgress({
      progress: 0,
      status: 'starting',
      message: '准备导出...'
    });
    
    try {
      // 准备导出数据，包含更多信息
      const exportData = imagesToExport.map((image, index) => ({
        序号: index + 1,
        文件名: image.file.name,
        文件大小: formatFileSize(image.file.size),
        识别状态: getStatusText(image.status),
        置信度: image.confidence ? `${(image.confidence * 100).toFixed(1)}%` : '未知',
        识别结果: image.text || '暂无识别结果',
        错误信息: image.error || ''
      }));

      // 准备图片数据，包含文件路径等信息
      const imageData = imagesToExport.map(image => ({
        ...image,
        file: {
          ...image.file,
          path: image.url // 使用url作为文件路径
        }
      }));

      // 调用主进程导出Excel
      const result = await window.electronAPI?.exportOCRExcel?.(exportData, imageData);
      
      if (!result) {
        setShowProgress(false);
        setIsExporting(false);
        message.error('用户取消导出');
      }
      // 成功和错误处理在进度监听器中处理
    } catch (error) {
      console.error('Export error:', error);
      setShowProgress(false);
      setIsExporting(false);
      message.error('导出过程中发生错误');
    }
  };

  const formatFileSize = (bytes: number): string => {
    const size = bytes / 1024;
    return size > 1024 
      ? `${(size / 1024).toFixed(1)}MB` 
      : `${size.toFixed(1)}KB`;
  };

  const getStatusText = (status: ImageData['status']): string => {
    const statusMap = {
      pending: '待识别',
      processing: '识别中',
      completed: '已完成',
      error: '识别失败'
    };
    return statusMap[status];
  };

  const getProgressStatus = () => {
    switch (exportProgress.status) {
      case 'error':
        return 'exception';
      case 'completed':
        return 'success';
      default:
        return 'active';
    }
  };

  const completedCount = images.filter(img => img.status === 'completed').length;
  const hasData = images.length > 0;
  const hasCompletedData = completedCount > 0;

  return (
    <>
      <Button
        type="default"
        icon={isExporting ? <LoadingOutlined /> : <ExportOutlined />}
        onClick={handleExport}
        loading={isExporting}
        disabled={!hasData}
        data-testid="export-button"
      >
        导出Excel {hasCompletedData && `(${completedCount}张已识别)`}
      </Button>

      {/* 导出进度弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ExportOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            导出进度
          </div>
        }
        open={showProgress}
        footer={null}
        closable={exportProgress.status === 'completed' || exportProgress.status === 'error'}
        centered
        width={450}
        destroyOnClose
      >
        <div style={{ padding: '20px 0' }}>
          <Progress
            percent={exportProgress.progress}
            status={getProgressStatus()}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
            format={(percent) => 
              exportProgress.status === 'completed' ? '完成' : 
              exportProgress.status === 'error' ? '失败' : 
              `${percent}%`
            }
          />
          
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Text type="secondary">{exportProgress.message}</Text>
          </div>
          
          {exportProgress.status === 'completed' && (
            <div style={{ 
              marginTop: 16, 
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '6px'
            }}>
              <Text type="success">✅ 导出完成！文件已保存到您选择的位置。</Text>
            </div>
          )}
          
          {exportProgress.status === 'error' && (
            <div style={{ 
              marginTop: 16, 
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '6px'
            }}>
              <Text type="danger">❌ 导出失败，请检查文件权限后重试。</Text>
            </div>
          )}
          
          {exportProgress.status === 'processing' && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                正在处理 {images.length} 张图片，请稍候...
              </Text>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default ExportButton;