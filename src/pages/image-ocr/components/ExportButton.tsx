import React, { useState, useCallback, useEffect } from 'react';
import { Button, message, Modal, Progress, Typography } from 'antd';
import { ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ImageData } from '../index';
import { collectImageData, validateImageData } from '../../../utils/imageDataCollector';
import { exportDebugger } from '../../../utils/exportDebugger';

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
      // 清空之前的调试日志
      exportDebugger.clear();
      
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

      // 收集图片的ArrayBuffer数据
      const imageBuffers = new Map<string, ArrayBuffer>();
      
      setExportProgress({
        progress: 5,
        status: 'processing',
        message: '收集图片数据...'
      });

      for (let i = 0; i < imagesToExport.length; i++) {
        const image = imagesToExport[i];
        let collectedBuffer: ArrayBuffer | null = null;
        let collectionMethod = 'unknown';
        let errorMessage: string | undefined;
        
        try {
          console.log(`🔄 Processing image ${i + 1}/${imagesToExport.length}: ${image.file.name}`);
          console.log(`   - Image ID: ${image.id}`);
          console.log(`   - File size: ${image.file.size} bytes`);
          console.log(`   - File type: ${image.file.type}`);
          
          // 使用新的图片数据收集工具
          const result = await collectImageData(image.file, image.url);
          
          if (result.success && result.data) {
            // 验证数据有效性
            const validation = validateImageData(result.data, image.file.name);
            
            if (validation.valid) {
              collectedBuffer = result.data;
              collectionMethod = result.method || 'unknown';
              imageBuffers.set(image.id, result.data);
              console.log(`✅ Successfully collected buffer for: ${image.file.name}`);
              console.log(`   - Size: ${result.data.byteLength} bytes`);
              console.log(`   - Method: ${result.method}`);
              console.log(`   - Image ID: ${image.id}`);
            } else {
              errorMessage = validation.error;
              console.error(`❌ Invalid image data for ${image.file.name}: ${validation.error}`);
            }
          } else {
            errorMessage = result.error;
            console.error(`❌ Failed to collect buffer for ${image.file.name}: ${result.error}`);
          }
          
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Error processing image ${image.file.name}:`, error);
        }
        
        // 记录调试信息
        exportDebugger.logImageProcessing(
          image.id,
          image.file.name,
          image.file,
          image.url,
          collectedBuffer,
          collectionMethod,
          errorMessage
        );
        
        // 更新进度
        const progress = 5 + Math.round((i / imagesToExport.length) * 10);
        setExportProgress({
          progress,
          status: 'processing',
          message: `收集图片数据 ${i + 1}/${imagesToExport.length}...`
        });
      }

      // 输出收集结果摘要
      console.log(`📊 Image collection summary:`);
      console.log(`   - Total images: ${imagesToExport.length}`);
      console.log(`   - Successfully collected: ${imageBuffers.size}`);
      console.log(`   - Failed: ${imagesToExport.length - imageBuffers.size}`);
      console.log(`   - Success rate: ${((imageBuffers.size / imagesToExport.length) * 100).toFixed(1)}%`);

      // 准备图片数据，包含文件路径等信息
      const imageData = imagesToExport.map(image => ({
        ...image,
        file: {
          ...image.file,
          name: image.file?.name || image.url || `image_${imagesToExport.indexOf(image) + 1}`, // 确保文件名不为空
          path: image.url // 使用url作为文件路径
        }
      }));

      setExportProgress({
        progress: 15,
        status: 'processing',
        message: '开始导出Excel...'
      });

      // 将Map转换为普通对象，以便传递给主进程
      const imageBuffersObj: { [key: string]: ArrayBuffer } = {};
      imageBuffers.forEach((buffer, id) => {
        // 验证缓冲区数据的完整性
        if (buffer && buffer.byteLength > 0) {
          imageBuffersObj[id] = buffer;
          console.log(`📦 Adding buffer to export object: ${id}, size: ${buffer.byteLength} bytes`);
        } else {
          console.warn(`⚠️ Skipping invalid buffer for ID: ${id}`);
        }
      });

      // 生成并输出调试报告
      const debugSummary = exportDebugger.getSummary();
      console.log('=== 📊 图片收集调试摘要 ===');
      console.log(`总图片数: ${debugSummary.total}`);
      console.log(`成功收集: ${debugSummary.successful}`);
      console.log(`失败数量: ${debugSummary.failed}`);
      console.log(`成功率: ${debugSummary.successRate.toFixed(1)}%`);
      console.log('方法统计:', debugSummary.methodStats);
      if (debugSummary.commonErrors.length > 0) {
        console.log('常见错误:', debugSummary.commonErrors);
      }
      
      // 如果有失败的图片，输出详细报告
      if (debugSummary.failed > 0) {
        console.log('详细调试报告:');
        console.log(exportDebugger.generateReport());
      }
      
      // 输出导出信息
      console.log('🚀 Export info:', {
        totalImages: imagesToExport.length,
        buffersCollected: imageBuffers.size,
        buffersInExportObj: Object.keys(imageBuffersObj).length,
        imageDataLength: imageData.length,
        exportDataLength: exportData.length,
        successRate: `${debugSummary.successRate.toFixed(1)}%`,
        bufferSizes: Object.entries(imageBuffersObj).map(([id, buffer]) => ({
          id,
          size: buffer.byteLength
        }))
      });

      // 验证所有数据都已准备就绪
      if (Object.keys(imageBuffersObj).length === 0 && imagesToExport.length > 0) {
        console.warn('⚠️ No image buffers collected, Excel export may not include images');
      }

      // 调用主进程导出Excel
      console.log('📤 Calling main process for Excel export...');
      const result = await window.electronAPI?.exportOCRExcel?.(exportData, imageData, imageBuffersObj);
      
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
      
      // 提供更详细的错误信息
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`导出过程中发生错误: ${errorMessage}`);
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