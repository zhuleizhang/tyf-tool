import React, { useCallback } from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Dragger } = Upload;

interface ImageUploadProps {
  onUpload: (files: File[]) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUpload }) => {
  const handleUpload = useCallback((options: any) => {
    const { file } = options;
    
    if (file instanceof File) {
      // 验证文件类型
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只支持图片文件！');
        return;
      }

      // 验证文件大小（限制为10MB）
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('图片大小不能超过10MB！');
        return;
      }

      onUpload([file]);
    }
  }, [onUpload]);

  const handleMultipleUpload = useCallback((info: any) => {
    const { fileList } = info;
    
    // 过滤出新上传的文件
    const newFiles = fileList
      .filter((file: any) => file.originFileObj)
      .map((file: any) => file.originFileObj as File)
      .filter((file: File) => {
        const isImage = file.type.startsWith('image/');
        const isLt10M = file.size / 1024 / 1024 < 10;
        
        if (!isImage) {
          message.error(`${file.name} 不是图片文件`);
          return false;
        }
        
        if (!isLt10M) {
          message.error(`${file.name} 文件过大，请选择小于10MB的图片`);
          return false;
        }
        
        return true;
      });

    if (newFiles.length > 0) {
      onUpload(newFiles);
    }
  }, [onUpload]);

  return (
    <Dragger
      name="images"
      multiple
      accept="image/*"
      customRequest={handleUpload}
      onChange={handleMultipleUpload}
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