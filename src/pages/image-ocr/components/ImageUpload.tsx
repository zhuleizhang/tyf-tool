import React, { useCallback } from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Dragger } = Upload;

interface ImageUploadProps {
  onUpload: (files: File[]) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUpload }) => {
  // 使用 beforeUpload 来处理文件验证和上传，避免重复处理
  const handleBeforeUpload = useCallback((file: File, fileList: File[]) => {
    // 验证文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error(`${file.name} 不是图片文件`);
      return false;
    }

    // 验证文件大小（限制为10MB）
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error(`${file.name} 文件过大，请选择小于10MB的图片`);
      return false;
    }

    // 如果是最后一个文件，处理整个文件列表
    if (fileList.indexOf(file) === fileList.length - 1) {
      // 过滤出有效的图片文件
      const validFiles = fileList.filter((f: File) => {
        const isValidImage = f.type.startsWith('image/');
        const isValidSize = f.size / 1024 / 1024 < 10;
        return isValidImage && isValidSize;
      });

      if (validFiles.length > 0) {
        // 使用 setTimeout 确保在组件更新后处理
        setTimeout(() => {
          onUpload(validFiles);
        }, 0);
      }
    }

    // 返回 false 阻止默认上传行为
    return false;
  }, [onUpload]);

  return (
    <Dragger
      name="images"
      multiple
      accept="image/*"
      beforeUpload={handleBeforeUpload}
      showUploadList={false}
      style={{ padding: '20px' }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
      </p>
      <p className="ant-upload-text">
        点击或拖拽图片到此区域上传
      </p>
      <p className="ant-upload-hint">
        支持单个或批量上传，支持jpg、png、gif等图片格式，单个文件不超过10MB
      </p>
    </Dragger>
  );
};

export default ImageUpload;