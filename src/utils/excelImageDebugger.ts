/**
 * Excel图片嵌入调试工具
 * 用于诊断和解决Excel图片嵌入问题
 */

export interface ImageEmbedDebugInfo {
  imageId: string;
  fileName: string;
  fileSize: number;
  bufferSize: number;
  extension: string;
  isValidBuffer: boolean;
  embedSuccess: boolean;
  embedError?: string;
  position: {
    row: number;
    col: number;
  };
}

export class ExcelImageDebugger {
  private debugInfos: ImageEmbedDebugInfo[] = [];
  private startTime: number = Date.now();

  /**
   * 记录图片嵌入调试信息
   */
  logImageEmbed(info: ImageEmbedDebugInfo): void {
    this.debugInfos.push({
      ...info,
      fileSize: Math.round(info.fileSize / 1024) // 转换为KB
    });
  }

  /**
   * 获取调试摘要
   */
  getSummary() {
    const total = this.debugInfos.length;
    const successful = this.debugInfos.filter(info => info.embedSuccess).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    const extensionStats = this.debugInfos.reduce((acc, info) => {
      acc[info.extension] = (acc[info.extension] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonErrors = this.debugInfos
      .filter(info => !info.embedSuccess && info.embedError)
      .reduce((acc, info) => {
        const error = info.embedError!;
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      total,
      successful,
      failed,
      successRate,
      extensionStats,
      commonErrors: Object.entries(commonErrors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => ({ error, count })),
      processingTime: Date.now() - this.startTime
    };
  }

  /**
   * 生成详细调试报告
   */
  generateReport(): string {
    const summary = this.getSummary();
    const lines: string[] = [];

    lines.push('=== Excel图片嵌入调试报告 ===');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`处理时间: ${summary.processingTime}ms`);
    lines.push('');

    lines.push('📊 总体统计:');
    lines.push(`  总图片数: ${summary.total}`);
    lines.push(`  成功嵌入: ${summary.successful}`);
    lines.push(`  嵌入失败: ${summary.failed}`);
    lines.push(`  成功率: ${summary.successRate.toFixed(1)}%`);
    lines.push('');

    if (Object.keys(summary.extensionStats).length > 0) {
      lines.push('📁 文件格式统计:');
      Object.entries(summary.extensionStats).forEach(([ext, count]) => {
        lines.push(`  ${ext}: ${count} 个文件`);
      });
      lines.push('');
    }

    if (summary.commonErrors.length > 0) {
      lines.push('❌ 常见错误:');
      summary.commonErrors.forEach(({ error, count }) => {
        lines.push(`  ${error} (${count}次)`);
      });
      lines.push('');
    }

    if (summary.failed > 0) {
      lines.push('🔍 失败详情:');
      this.debugInfos
        .filter(info => !info.embedSuccess)
        .forEach((info, index) => {
          lines.push(`  ${index + 1}. ${info.fileName}`);
          lines.push(`     - 文件大小: ${info.fileSize}KB`);
          lines.push(`     - 缓冲区大小: ${info.bufferSize} bytes`);
          lines.push(`     - 文件格式: ${info.extension}`);
          lines.push(`     - 缓冲区有效: ${info.isValidBuffer ? '是' : '否'}`);
          lines.push(`     - 错误信息: ${info.embedError || '未知错误'}`);
          lines.push(`     - 位置: 行${info.position.row}, 列${info.position.col}`);
          lines.push('');
        });
    }

    if (summary.successful > 0) {
      lines.push('✅ 成功详情:');
      this.debugInfos
        .filter(info => info.embedSuccess)
        .forEach((info, index) => {
          lines.push(`  ${index + 1}. ${info.fileName} (${info.fileSize}KB, ${info.extension})`);
        });
      lines.push('');
    }

    lines.push('💡 故障排除建议:');
    if (summary.failed > 0) {
      const hasInvalidBuffers = this.debugInfos.some(info => !info.isValidBuffer);
      const hasLargeFiles = this.debugInfos.some(info => info.fileSize > 10240); // 10MB
      
      if (hasInvalidBuffers) {
        lines.push('  - 检查图片文件是否损坏或格式不支持');
        lines.push('  - 尝试重新选择图片文件');
      }
      
      if (hasLargeFiles) {
        lines.push('  - 压缩过大的图片文件（建议小于10MB）');
      }
      
      lines.push('  - 确保图片格式为 JPEG、PNG 或 GIF');
      lines.push('  - 检查系统内存是否充足');
      lines.push('  - 尝试分批导出图片');
    } else {
      lines.push('  - 所有图片均成功嵌入！');
    }

    return lines.join('\n');
  }

  /**
   * 清空调试信息
   */
  clear(): void {
    this.debugInfos = [];
    this.startTime = Date.now();
  }

  /**
   * 导出调试数据为JSON
   */
  exportDebugData() {
    return {
      summary: this.getSummary(),
      details: this.debugInfos,
      timestamp: new Date().toISOString()
    };
  }
}

// 创建全局实例
export const excelImageDebugger = new ExcelImageDebugger();