import { create } from 'zustand';
import { GlobalConfig } from '../types/config';
import { ConfigStorage } from '../utils/configStorage';

// 定义全局状态类型
interface GlobalState {
	// 状态
	config: GlobalConfig;
	isLoading: boolean;

	// 操作
	updateConfig: (newConfig: GlobalConfig) => Promise<void>;
	resetConfig: () => void;
	reloadConfig: () => void;
}

/**
 * 创建全局状态store
 */
export const useGlobalConfigStore = create<GlobalState>((set, get) => ({
	// 初始状态
	config: ConfigStorage.loadConfig(),
	isLoading: false,

	// 操作方法
	updateConfig: async (newConfig: GlobalConfig) => {
		set({ isLoading: true });
		try {
			// 验证配置
			const validation = ConfigStorage.validateConfig(newConfig);
			if (!validation.isValid) {
				throw new Error(
					`配置验证失败: ${validation.errors
						.map((e) => e.message)
						.join(', ')}`
				);
			}

			// 保存配置
			ConfigStorage.saveConfig(newConfig);
			set({ config: newConfig, isLoading: false });
		} catch (error) {
			console.error('更新配置失败:', error);
			set({ isLoading: false });
			throw error;
		}
	},

	resetConfig: () => {
		ConfigStorage.resetConfig();
		set({ config: ConfigStorage.loadConfig() });
	},

	reloadConfig: () => {
		set({ config: ConfigStorage.loadConfig() });
	},
}));

/**
 * 全局配置Hook (兼容旧API)
 */
export function useGlobalConfig() {
	const { config, updateConfig, resetConfig, reloadConfig, isLoading } =
		useGlobalConfigStore();

	return {
		config,
		updateConfig,
		resetConfig,
		reloadConfig,
		isLoading,
	};
}

/**
 * 获取特定配置段的Hook
 */
export function useConfigSection<T extends keyof GlobalConfig>(
	section: T
): [GlobalConfig[T], (newValue: GlobalConfig[T]) => Promise<void>] {
	const { config, updateConfig } = useGlobalConfigStore();

	const updateSection = async (newValue: GlobalConfig[T]) => {
		const newConfig = {
			...config,
			[section]: newValue,
		};
		await updateConfig(newConfig);
	};

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
