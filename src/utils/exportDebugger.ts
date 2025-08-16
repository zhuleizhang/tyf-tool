/**
 * 导出调试工具
 * 用于诊断和调试Excel导出过程中的图片处理问题
 */

export interface DebugInfo {
  timestamp: string;
  imageId: string;
  fileName: string;
  fileSize: number;
  hasFile: boolean;
  hasUrl: boolean;
  urlType: string;
  bufferCollected: boolean;
  bufferSize: number;
  collectionMethod: string;
  validationResult: boolean;
  error?: string;
}

export class ExportDebugger {
  private debugLog: DebugInfo[] = [];
  
  /**
   * 记录图片处理的调试信息
   */
  logImageProcessing(
    imageId: string,
    fileName: string,
    file: File | null,
    url: string | null,
    buffer: ArrayBuffer | null,
    method: string,
    error?: string
  ): void {
    const debugInfo: DebugInfo = {
      timestamp: new Date().toISOString(),
      imageId,
      fileName: fileName || 'unknown',
      fileSize: file?.size || 0,
      hasFile: !!file,
      hasUrl: !!url,
      urlType: url ? (url.startsWith('blob:') ? 'blob' : 'other') : 'none',
      bufferCollected: !!buffer,
      bufferSize: buffer?.byteLength || 0,
      collectionMethod: method,
      validationResult: !!buffer && buffer.byteLength > 0,
      error
    };
    
    this.debugLog.push(debugInfo);
    
    // 输出到控制台
    const status = debugInfo.bufferCollected ? '✅' : '❌';
    console.log(`${status} Image Debug [${debugInfo.imageId}]:`, {
      fileName: debugInfo.fileName,
      fileSize: `${(debugInfo.fileSize / 1024).toFixed(1)}KB`,
      hasFile: debugInfo.hasFile,
      hasUrl: debugInfo.hasUrl,
      urlType: debugInfo.urlType,
      bufferSize: `${(debugInfo.bufferSize / 1024).toFixed(1)}KB`,
      method: debugInfo.collectionMethod,
      error: debugInfo.error
    });
  }
  
  /**
   * 获取调试摘要
   */
  getSummary(): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    commonErrors: string[];
    methodStats: { [method: string]: number };
  } {
    const total = this.debugLog.length;
    const successful = this.debugLog.filter(log => log.bufferCollected).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    
    // 统计常见错误
    const errors = this.debugLog
      .filter(log => log.error)
      .map(log => log.error!)
      .reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as { [error: string]: number });
    
    const commonErrors = Object.entries(errors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);
    
    // 统计方法使用情况
    const methodStats = this.debugLog
      .reduce((acc, log) => {
        acc[log.collectionMethod] = (acc[log.collectionMethod] || 0) + 1;
        return acc;
      }, {} as { [method: string]: number });
    
    return {
      total,
      successful,
      failed,
      successRate,
      commonErrors,
      methodStats
    };
  }
  
  /**
   * 生成详细的调试报告
   */
  generateReport(): string {
    const summary = this.getSummary();
    
    let report = `
=== 图片导出调试报告 ===
生成时间: ${new Date().toLocaleString('zh-CN')}

📊 总体统计:
- 总图片数: ${summary.total}
- 成功收集: ${summary.successful}
- 失败数量: ${summary.failed}
- 成功率: ${summary.successRate.toFixed(1)}%

🔧 方法使用统计:
${Object.entries(summary.methodStats)
  .map(([method, count]) => `- ${method}: ${count} 次`)
  .join('\n')}

❌ 常见错误:
${summary.commonErrors.length > 0 
  ? summary.commonErrors.map((error, index) => `${index + 1}. ${error}`).join('\n')
  : '无错误记录'
}

📝 详细日志:
${this.debugLog.map((log, index) => `
${index + 1}. ${log.fileName}
   - ID: ${log.imageId}
   - 时间: ${log.timestamp}
   - 文件大小: ${(log.fileSize / 1024).toFixed(1)}KB
   - 有File对象: ${log.hasFile ? '是' : '否'}
   - 有URL: ${log.hasUrl ? '是' : '否'} (${log.urlType})
   - 收集方法: ${log.collectionMethod}
   - 缓冲区大小: ${(log.bufferSize / 1024).toFixed(1)}KB
   - 状态: ${log.bufferCollected ? '成功' : '失败'}
   ${log.error ? `- 错误: ${log.error}` : ''}
`).join('\n')}

=== 报告结束 ===
    `;
    
    return report;
  }
  
  /**
   * 清空调试日志
   */
  clear(): void {
    this.debugLog = [];
  }
  
  /**
   * 导出调试数据为JSON
   */
  exportJSON(): string {
    return JSON.stringify({
      summary: this.getSummary(),
      logs: this.debugLog
    }, null, 2);
  }
}

// 全局调试器实例
export const exportDebugger = new ExportDebugger();