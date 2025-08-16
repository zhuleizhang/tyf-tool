/**
 * 图片数据收集工具
 * 提供多种方法来收集图片的ArrayBuffer数据
 */

export interface ImageDataResult {
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
  method?: string;
}

/**
 * 从File对象收集ArrayBuffer数据
 */
export async function collectFromFile(file: File): Promise<ImageDataResult> {
  try {
    if (!file || !(file instanceof File)) {
      return {
        success: false,
        error: 'Invalid File object'
      };
    }

    const arrayBuffer = await file.arrayBuffer();
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return {
        success: false,
        error: 'Empty ArrayBuffer from File'
      };
    }

    return {
      success: true,
      data: arrayBuffer,
      method: 'File.arrayBuffer()'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in File.arrayBuffer()',
      method: 'File.arrayBuffer()'
    };
  }
}

/**
 * 从Blob URL收集ArrayBuffer数据
 */
export async function collectFromBlobUrl(url: string): Promise<ImageDataResult> {
  try {
    if (!url || !url.startsWith('blob:')) {
      return {
        success: false,
        error: 'Invalid blob URL'
      };
    }

    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        method: 'fetch(blob:)'
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return {
        success: false,
        error: 'Empty ArrayBuffer from blob URL',
        method: 'fetch(blob:)'
      };
    }

    return {
      success: true,
      data: arrayBuffer,
      method: 'fetch(blob:)'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in fetch(blob:)',
      method: 'fetch(blob:)'
    };
  }
}

/**
 * 使用FileReader收集ArrayBuffer数据（备用方法）
 */
export async function collectFromFileReader(file: File): Promise<ImageDataResult> {
  return new Promise((resolve) => {
    try {
      if (!file || !(file instanceof File)) {
        resolve({
          success: false,
          error: 'Invalid File object'
        });
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target?.result;
          if (result instanceof ArrayBuffer) {
            if (result.byteLength === 0) {
              resolve({
                success: false,
                error: 'Empty ArrayBuffer from FileReader',
                method: 'FileReader'
              });
            } else {
              resolve({
                success: true,
                data: result,
                method: 'FileReader'
              });
            }
          } else {
            resolve({
              success: false,
              error: 'FileReader result is not ArrayBuffer',
              method: 'FileReader'
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error in FileReader onload',
            method: 'FileReader'
          });
        }
      };

      reader.onerror = () => {
        resolve({
          success: false,
          error: 'FileReader error',
          method: 'FileReader'
        });
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in FileReader setup',
        method: 'FileReader'
      });
    }
  });
}

/**
 * 综合收集图片数据的主函数
 * 按优先级尝试多种方法
 */
export async function collectImageData(file: File, url?: string): Promise<ImageDataResult> {
  console.log(`🔍 Starting image data collection for: ${file.name}`);
  console.log(`   - File size: ${file.size} bytes`);
  console.log(`   - File type: ${file.type}`);
  console.log(`   - URL: ${url || 'not provided'}`);
  
  const methods = [
    // 方法1：直接从File对象获取（优先使用，最可靠）
    async () => await collectFromFile(file),
    
    // 方法2：从blob URL获取（如果提供）
    async () => {
      if (url && url.startsWith('blob:')) {
        return await collectFromBlobUrl(url);
      }
      return { success: false, error: 'No blob URL provided' };
    },
    
    // 方法3：使用FileReader（备用方法）
    async () => await collectFromFileReader(file)
  ];

  const errors: string[] = [];

  for (let i = 0; i < methods.length; i++) {
    try {
      console.log(`🔄 Trying method ${i + 1}...`);
      const result = await methods[i]();
      if (result.success && result.data) {
        console.log(`✅ Successfully collected image data using method ${i + 1} (${result.method})`);
        console.log(`   - Data size: ${result.data.byteLength} bytes`);
        
        // 额外验证数据完整性
        if (result.data.byteLength > 0) {
          return result;
        } else {
          errors.push(`Method ${i + 1} (${result.method}): Empty data returned`);
        }
      } else {
        errors.push(`Method ${i + 1} (${result.method || 'unknown'}): ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Method ${i + 1} failed:`, errorMsg);
      errors.push(`Method ${i + 1}: ${errorMsg}`);
    }
  }

  console.error(`❌ All collection methods failed for: ${file.name}`);
  console.error(`   Errors: ${errors.join('; ')}`);

  return {
    success: false,
    error: `All methods failed: ${errors.join('; ')}`
  };
}

/**
 * 验证ArrayBuffer数据的有效性
 */
export function validateImageData(arrayBuffer: ArrayBuffer, fileName: string): { valid: boolean; error?: string } {
  if (!arrayBuffer) {
    return { valid: false, error: 'ArrayBuffer is null or undefined' };
  }

  if (arrayBuffer.byteLength === 0) {
    return { valid: false, error: 'ArrayBuffer is empty' };
  }

  // 检查文件大小限制（50MB）
  const maxSize = 50 * 1024 * 1024;
  if (arrayBuffer.byteLength > maxSize) {
    return { 
      valid: false, 
      error: `File too large: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB > 50MB` 
    };
  }

  // 基本的图片文件头检查
  const uint8Array = new Uint8Array(arrayBuffer);
  const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8;
  const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47;
  const isGIF = uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46;
  const isBMP = uint8Array[0] === 0x42 && uint8Array[1] === 0x4D;
  const isWEBP = uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50;

  if (!isJPEG && !isPNG && !isGIF && !isBMP && !isWEBP) {
    return { 
      valid: false, 
      error: 'Invalid image file format (header check failed)' 
    };
  }

  return { valid: true };
}