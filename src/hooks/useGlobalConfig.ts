import { useState, useCallback, useEffect } from 'react';
import { GlobalConfig, ImageOcrConfig, ExcelDiffConfig } from '../types/config';
import { ConfigStorage } from '../utils/configStorage';

/**
 * 全局配置Hook
 */
export function useGlobalConfig() {
  const [config, setConfig] = useState<GlobalConfig>(() => ConfigStorage.loadConfig());
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 更新配置
   */
  const updateConfig = useCallback(async (newConfig: GlobalConfig) => {
    setIsLoading(true);
    try {
      // 验证配置
      const validation = ConfigStorage.validateConfig(newConfig);
      if (!validation.isValid) {
        throw new Error(`配置验证失败: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // 保存配置
      ConfigStorage.saveConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('更新配置失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 重置配置
   */
  const resetConfig = useCallback(() => {
    ConfigStorage.resetConfig();
    setConfig(ConfigStorage.loadConfig());
  }, []);

  /**
   * 重新加载配置
   */
  const reloadConfig = useCallback(() => {
    setConfig(ConfigStorage.loadConfig());
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    reloadConfig,
    isLoading
  };
}

/**
 * 获取特定配置段的Hook
 */
export function useConfigSection<T extends keyof GlobalConfig>(section: T): [GlobalConfig[T], (newValue: GlobalConfig[T]) => Promise<void>] {
  const { config, updateConfig } = useGlobalConfig();

  const updateSection = useCallback(async (newValue: GlobalConfig[T]) => {
    const newConfig = {
      ...config,
      [section]: newValue
    };
    await updateConfig(newConfig);
  }, [config, section, updateConfig]);

  return [config[section], updateSection];
}

/**
 * 图片OCR配置Hook
 */
export function useImageOcrConfig() {
  return useConfigSection('imageOcr');
}

/**
 * Excel差异分析配置Hook
 */
export function useExcelDiffConfig() {
  return useConfigSection('excelDiff');
}