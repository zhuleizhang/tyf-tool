// 在文件顶部导入 heic2any 库
import { useState, useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import type { ImageData } from '../index';
import heic2any from 'heic2any';

// 文件大小限制（50MB）
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
// 最大图片数量限制
const MAX_IMAGE_COUNT = Infinity;

export const useImageManager = () => {
	const [images, setImages] = useState<ImageData[]>([]);
	const urlCacheRef = useRef<Set<string>>(new Set());

	// 组件卸载时清理所有URL对象
	useEffect(() => {
		return () => {
			urlCacheRef.current.forEach((url) => {
				URL.revokeObjectURL(url);
			});
			urlCacheRef.current.clear();
		};
	}, []);

	// 验证文件 - 注意：需要将此函数改为 async 函数
	const validateFiles = useCallback(
		async (
			files: File[]
		): Promise<{
			valid: File[];
			invalid: { file: File; reason: string }[];
		}> => {
			const valid: File[] = [];
			const invalid: { file: File; reason: string }[] = [];

			for (const file of files) {
				// 检查文件大小
				if (file.size > MAX_FILE_SIZE) {
					invalid.push({
						file,
						reason: `文件过大 (${(file.size / 1024 / 1024).toFixed(
							1
						)}MB > ${MAX_FILE_SIZE_MB}MB)`,
					});
					continue;
				}

				// 检查文件类型
				if (!file.type.startsWith('image/')) {
					invalid.push({ file, reason: '不是有效的图片文件' });
					continue;
				}

				// 检查是否为heic图片格式，如果是就转换为jpeg格式
				if (
					file.type === 'image/heic' ||
					file.name.toLowerCase().endsWith('.heic')
				) {
					try {
						// 使用 heic2any 转换为 JPEG 格式
						const convertedBlob = await heic2any({
							blob: file,
							toType: 'image/jpeg',
							quality: 0.8,
						});

						// 创建新的 File 对象，保留原始文件名特征
						const fileNameWithoutExt =
							file.name.substring(
								0,
								file.name.lastIndexOf('.')
							) || file.name;
						const convertedFile = new File(
							Array.isArray(convertedBlob)
								? convertedBlob
								: [convertedBlob],
							`${fileNameWithoutExt}.jpg`,
							{
								type: 'image/jpeg',
							}
						);

						valid.push(convertedFile);
					} catch (error) {
						invalid.push({ file, reason: 'HEIC 格式转换失败' });
						continue;
					}
				} else {
					valid.push(file);
				}
			}

			return { valid, invalid };
		},
		[]
	);

	// 修改 addImages 函数以适应 async validateFiles
	const addImages = useCallback(
		async (files: File[]) => {
			// 检查图片数量限制
			if (images.length + files.length > MAX_IMAGE_COUNT) {
				message.error(
					`最多只能添加 ${MAX_IMAGE_COUNT} 张图片，当前已有 ${images.length} 张`
				);
				return;
			}

			// 验证文件 - 现在是异步的
			const { valid, invalid } = await validateFiles(files);

			// 显示无效文件的错误信息
			if (invalid.length > 0) {
				invalid.forEach(({ file, reason }) => {
					message.error(`${file.name}: ${reason}`);
				});
			}

			if (valid.length === 0) {
				return;
			}

			const newImages: ImageData[] = valid.map((file) => {
				const url = URL.createObjectURL(file);
				urlCacheRef.current.add(url);

				return {
					id: `${Date.now()}-${Math.random()
						.toString(36)
						.substr(2, 9)}`,
					file,
					url,
					text: '',
					status: 'pending' as const,
				};
			});

			setImages((prev) => [...prev, ...newImages]);

			if (valid.length > 0) {
				message.success(
					`成功添加 ${valid.length} 张图片${
						invalid.length > 0
							? `，${invalid.length} 张图片添加失败`
							: ''
					}`
				);
			}
		},
		[images.length, validateFiles]
	);

	const removeImage = useCallback((id: string) => {
		setImages((prev) => {
			const imageToRemove = prev.find((img) => img.id === id);
			if (imageToRemove) {
				// 清理URL对象
				URL.revokeObjectURL(imageToRemove.url);
				urlCacheRef.current.delete(imageToRemove.url);
			}
			return prev.filter((img) => img.id !== id);
		});
	}, []);

	const clearImages = useCallback(() => {
		setImages((prev) => {
			// 清理所有URL对象
			prev.forEach((img) => {
				URL.revokeObjectURL(img.url);
				urlCacheRef.current.delete(img.url);
			});
			return [];
		});
		urlCacheRef.current.clear();
	}, []);

	const updateImageText = useCallback(
		(
			id: string,
			text: string,
			status?: ImageData['status'],
			confidence?: number
		) => {
			setImages((prev) =>
				prev.map((img) =>
					img.id === id
						? {
								...img,
								text,
								...(status && { status }),
								...(confidence !== undefined && { confidence }),
						  }
						: img
				)
			);
		},
		[]
	);

	const updateImageStatus = useCallback(
		(
			id: string,
			status: ImageData['status'],
			progress?: number,
			error?: string,
			confidence?: number
		) => {
			setImages((prev) =>
				prev.map((img) =>
					img.id === id
						? {
								...img,
								status,
								progress,
								error,
								...(confidence !== undefined && { confidence }),
						  }
						: img
				)
			);
		},
		[]
	);

	const reorderImages = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			setImages((prev) => {
				const newImages = [...prev];
				const draggedItem = newImages[dragIndex];
				newImages.splice(dragIndex, 1);
				newImages.splice(hoverIndex, 0, draggedItem);
				return newImages;
			});
		},
		[]
	);

	const getImageById = useCallback(
		(id: string) => {
			return images.find((img) => img.id === id);
		},
		[images]
	);

	// 批量更新图片状态（性能优化）
	const batchUpdateImages = useCallback(
		(updates: Array<{ id: string; updates: Partial<ImageData> }>) => {
			setImages((prev) => {
				const updateMap = new Map(
					updates.map((u) => [u.id, u.updates])
				);
				return prev.map((img) => {
					const update = updateMap.get(img.id);
					return update ? { ...img, ...update } : img;
				});
			});
		},
		[]
	);

	// 获取统计信息
	const getStats = useCallback(() => {
		const total = images.length;
		const completed = images.filter(
			(img) => img.status === 'completed'
		).length;
		const processing = images.filter(
			(img) => img.status === 'processing'
		).length;
		const error = images.filter((img) => img.status === 'error').length;
		const pending = images.filter((img) => img.status === 'pending').length;

		const totalSize = images.reduce((sum, img) => sum + img.file.size, 0);
		const avgConfidence = images
			.filter((img) => img.status === 'completed' && img.confidence)
			.reduce(
				(sum, img, _, arr) => sum + (img.confidence || 0) / arr.length,
				0
			);

		return {
			total,
			completed,
			processing,
			error,
			pending,
			totalSize,
			avgConfidence: avgConfidence * 100, // 转换为百分比
		};
	}, [images]);

	return {
		images,
		addImages,
		removeImage,
		clearImages,
		updateImageText,
		updateImageStatus,
		reorderImages,
		getImageById,
		batchUpdateImages,
		getStats,
	};
};
