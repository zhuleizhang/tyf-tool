// axios 全局单例配置(包含请求和响应拦截器)
import axios, {
	AxiosInstance,
	AxiosRequestConfig,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from 'axios';

// 创建自定义错误类型
export class ApiError extends Error {
	code: number;
	data?: any;

	constructor(message: string, code: number, data?: any) {
		super(message);
		this.code = code;
		this.data = data;
		this.name = 'ApiError';
	}
}

/**
 * 标准响应格式
 */
export interface StandardResponse<T = any> {
	/** 响应状态码，0表示成功，其他值表示错误 */
	code: number;
	/** 响应数据 */
	data?: T;
	/** 响应消息，通常在发生错误时提供错误信息 */
	msg?: string;
}

// 默认配置
const defaultConfig: AxiosRequestConfig = {
	baseURL: 'http://localhost:8000', // 根据实际API地址修改
	timeout: 30000,
	headers: {
		'Content-Type': 'application/json',
	},
};

// 创建axios实例
const instance: AxiosInstance = axios.create(defaultConfig);

// 请求拦截器
instance.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		// 可以在这里添加认证token
		// const token = localStorage.getItem('token');
		// if (token) {
		//   config.headers.Authorization = `Bearer ${token}`;
		// }

		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// 响应拦截器
instance.interceptors.response.use(
	(response: AxiosResponse) => {
		// 直接返回响应数据
		const { code, data, msg } = response.data || {};
		if (code === 0) {
			return data;
		} else {
			return Promise.reject(new ApiError(msg || '请求失败', code, data));
		}
	},
	(error) => {
		if (error.response) {
			// 服务器返回了错误状态码
			const { status, data } = error.response;
			const message = data?.message || error.message || '请求失败';

			// 特定状态码处理
			if (status === 401) {
				// 未授权处理，可以在这里处理登出逻辑
				console.error('认证失败，请重新登录');
				// 可以在这里添加登出或重定向逻辑
			}

			return Promise.reject(new ApiError(message, status, data));
		} else if (error.request) {
			// 请求发出但没有收到响应
			return Promise.reject(new ApiError('网络异常，请检查网络连接', 0));
		} else {
			// 请求配置出错
			return Promise.reject(new ApiError('请求配置错误', 0));
		}
	}
);

// 封装常用方法
export const request = {
	/**
	 * GET请求
	 * @param url 请求地址
	 * @param params 请求参数
	 * @param config 额外配置
	 */
	get: <T = any>(url: string, params?: any, config?: AxiosRequestConfig) => {
		return instance.get<any, T>(url, { params, ...config });
	},

	/**
	 * POST请求
	 * @param url 请求地址
	 * @param data 请求数据
	 * @param config 额外配置
	 */
	post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => {
		return instance.post<any, T>(url, data, config);
	},

	/**
	 * PUT请求
	 * @param url 请求地址
	 * @param data 请求数据
	 * @param config 额外配置
	 */
	put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => {
		return instance.put<any, T>(url, data, config);
	},

	/**
	 * DELETE请求
	 * @param url 请求地址
	 * @param config 额外配置
	 */
	delete: <T = any>(url: string, config?: AxiosRequestConfig) => {
		return instance.delete<any, T>(url, config);
	},

	// /**
	//  * 上传文件
	//  * @param url 请求地址
	//  * @param formData FormData对象
	//  * @param config 额外配置
	//  */
	// upload: <T = any>(
	// 	url: string,
	// 	formData: FormData,
	// 	config?: AxiosRequestConfig
	// ) => {
	// 	const uploadConfig: AxiosRequestConfig = {
	// 		headers: {
	// 			'Content-Type': 'multipart/form-data',
	// 		},
	// 		...config,
	// 	};
	// 	return instance.post<any, T>(url, formData, uploadConfig);
	// },

	// /**
	//  * 自定义请求
	//  * @param config 完整请求配置
	//  */
	// custom: <T = any>(config: AxiosRequestConfig) => {
	// 	return instance.request<any, T>(config);
	// },
};

// 导出axios实例，以便进行更高级的自定义
export default instance;
