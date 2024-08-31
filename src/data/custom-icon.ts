import { IconSet } from '@iconify/tools';
import { IconifyJSON } from '@iconify/types';
import { readFile, writeFile } from 'node:fs/promises';

export async function loadIconSet(prefix: string) {
	const jsonStr = await readFile(`icons/${prefix}.json`, 'utf-8');
	return new IconSet(JSON.parse(jsonStr) as IconifyJSON);
}

export async function writeIconSet(prefix: string, jsonStr: string) {
	await writeFile(`icons/${prefix}.json`, jsonStr);
}
