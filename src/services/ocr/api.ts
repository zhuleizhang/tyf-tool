import { request } from '@/utils/request';
import type { OCRRequest, OCRResult } from './type';
import { API_BASE_URL } from '@/constants';

/** 识别图片文字 */
export const recognizeImage = (req: OCRRequest) => {
	return request.post<OCRResult>(`${API_BASE_URL}/ocr/recognize`, req);
};
