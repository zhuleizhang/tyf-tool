import { GlobalConfig, DEFAULT_GLOBAL_CONFIG, CONFIG_STORAGE_KEY, ConfigValidationResult, ConfigValidationError } from '../types/config';

/**
 * 配置存储工具类
 */
export class ConfigStorage {
  /**
   * 从本地存储加载配置
   */
  static loadConfig(): GlobalConfig {
    try {
      const storedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!storedConfig) {
        return DEFAULT_GLOBAL_CONFIG;
      }

      const parsedConfig = JSON.parse(storedConfig);
      return this.mergeWithDefault(parsedConfig);
    } catch (error) {
      console.error('加载配置失败:', error);
      return DEFAULT_GLOBAL_CONFIG;
    }
  }

  /**
   * 保存配置到本地存储
   */
  static saveConfig(config: GlobalConfig): void {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('保存配置失败:', error);
      throw new Error('保存配置失败');
    }
  }

  /**
   * 验证配置格式
   */
  static validateConfig(config: any): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];

    // 检查基本结构
    if (!config || typeof config !== 'object') {
      errors.push({
        path: 'root',
        message: '配置必须是一个对象'
      });
      return { isValid: false, errors };
    }

    // 检查 imageOcr 配置
    if (config.imageOcr) {
      if (typeof config.imageOcr !== 'object') {
        errors.push({
          path: 'imageOcr',
          message: 'imageOcr 配置必须是一个对象'
        });
      } else {
        // 检查 textFilter 配置
        if (config.imageOcr.textFilter) {
          const textFilter = config.imageOcr.textFilter;
          if (typeof textFilter !== 'object') {
            errors.push({
              path: 'imageOcr.textFilter',
              message: 'textFilter 配置必须是一个对象'
            });
          } else {
            // 检查 enabled 字段
            if (textFilter.enabled !== undefined && typeof textFilter.enabled !== 'boolean') {
              errors.push({
                path: 'imageOcr.textFilter.enabled',
                message: 'enabled 字段必须是布尔值'
              });
            }

            // 检查 rules 字段
            if (textFilter.rules !== undefined) {
              if (!Array.isArray(textFilter.rules)) {
                errors.push({
                  path: 'imageOcr.textFilter.rules',
                  message: 'rules 字段必须是数组'
                });
              } else {
                textFilter.rules.forEach((rule: any, index: number) => {
                  const rulePath = `imageOcr.textFilter.rules[${index}]`;
                  
                  if (!rule || typeof rule !== 'object') {
                    errors.push({
                      path: rulePath,
                      message: '规则必须是一个对象'
                    });
                    return;
                  }

                  // 检查必需字段
                  if (!rule.id || typeof rule.id !== 'string') {
                    errors.push({
                      path: `${rulePath}.id`,
                      message: 'id 字段必须是非空字符串'
                    });
                  }

                  if (!rule.name || typeof rule.name !== 'string') {
                    errors.push({
                      path: `${rulePath}.name`,
                      message: 'name 字段必须是非空字符串'
                    });
                  }

                  if (!rule.pattern || typeof rule.pattern !== 'string') {
                    errors.push({
                      path: `${rulePath}.pattern`,
                      message: 'pattern 字段必须是非空字符串'
                    });
                  } else {
                    // 验证正则表达式语法
                    try {
                      new RegExp(rule.pattern);
                    } catch (regexError: any) {
                      errors.push({
                        path: `${rulePath}.pattern`,
                        message: `正则表达式语法错误: ${regexError?.message || '未知错误'}`
                      });
                    }
                  }

                  if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
                    errors.push({
                      path: `${rulePath}.enabled`,
                      message: 'enabled 字段必须是布尔值'
                    });
                  }

                  if (rule.description !== undefined && typeof rule.description !== 'string') {
                    errors.push({
                      path: `${rulePath}.description`,
                      message: 'description 字段必须是字符串'
                    });
                  }
                });
              }
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 将配置与默认配置合并
   */
  private static mergeWithDefault(config: Partial<GlobalConfig>): GlobalConfig {
    return {
      imageOcr: {
        textFilter: {
          enabled: config.imageOcr?.textFilter?.enabled ?? DEFAULT_GLOBAL_CONFIG.imageOcr.textFilter.enabled,
          rules: config.imageOcr?.textFilter?.rules ?? DEFAULT_GLOBAL_CONFIG.imageOcr.textFilter.rules
        }
      },
      excelDiff: config.excelDiff ?? DEFAULT_GLOBAL_CONFIG.excelDiff
    };
  }

  /**
   * 重置配置为默认值
   */
  static resetConfig(): void {
    this.saveConfig(DEFAULT_GLOBAL_CONFIG);
  }

  /**
   * 清除配置
   */
  static clearConfig(): void {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  }
}