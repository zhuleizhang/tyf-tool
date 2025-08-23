/**
 * 文字过滤规则接口
 */
export interface TextFilterRule {
  id: string;
  name: string;
  pattern: string; // 正则表达式
  enabled: boolean;
  description?: string;
}

/**
 * 图片OCR配置接口
 */
export interface ImageOcrConfig {
  textFilter: {
    enabled: boolean;
    rules: TextFilterRule[];
  };
}

/**
 * Excel差异分析配置接口
 */
export interface ExcelDiffConfig {
  // 未来扩展功能配置
  [key: string]: any;
}

/**
 * 全局配置接口
 */
export interface GlobalConfig {
  imageOcr: ImageOcrConfig;
  excelDiff: ExcelDiffConfig;
}

/**
 * 配置验证错误接口
 */
export interface ConfigValidationError {
  path: string;
  message: string;
}

/**
 * 配置验证结果接口
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
}

/**
 * 默认全局配置
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  imageOcr: {
    textFilter: {
      enabled: false,
      rules: []
    }
  },
  excelDiff: {}
};

/**
 * 配置存储键名
 */
export const CONFIG_STORAGE_KEY = 'tyf_tool_global_config';