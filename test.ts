import { createWorker } from 'tesseract.js';

(async () => {
	const worker = await createWorker('eng');
	const ret = await worker.recognize(
		'https://tesseract.projectnaptha.com/img/eng_bw.png'
	);
	console.log(ret.data.text);
	await worker.terminate();
})();
