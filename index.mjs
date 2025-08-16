const fs = require('fs'),
	p = require('path'),
	{exec} = require('child_process');

var CACHE_TIME = 10000;

function extract(code, string, value = 1)
{
	string = string.match(code);
	return (string !== null && typeof string[value] != 'undefined') ? string[value] : '';
}

function splitPath(path)
{
	// return path.split(p.sep).filter(Boolean);

	const first = extract(/^([\\\/]*[^\\\/]+)[\\\/]*/, path);
	const segments = path.replace(/^([\\\/]*[^\\\/]+)[\\\/]*/, '').split(p.sep).filter(Boolean);

	segments.unshift(first);

	return segments;
}

function generateShort(segment)
{
	segment = segment.toUpperCase();
	segment = segment.replace(/[,\+;=\[\]]/g, '_');
	segment = segment.replace(/[^A-Z0-9!#$%&'()-@^_`{}~]/g, '');

	return segment.substring(0, 6);
}

function generateExt(segment)
{
	const ext = generateShort(p.extname(segment)).substring(0, 4);

	return (ext.length > 1 ? ext : '');
}

var shortSegmentCache = new Map();

async function shortSegment(path, segment)
{
	const now = Date.now();
	const short = generateShort(segment);
	const ext = generateExt(segment);

	let shortSegment;

	const _shortSegmentCache = getCache(shortSegmentCache, path);

	if(_shortSegmentCache)
	{
		shortSegment = short+'~'+_shortSegmentCache.get(segment)+(ext ? ext : '');
	}
	else
	{
		const map = new Map();
		setCache(shortSegmentCache, path, map);

		const fixedPath = path.endsWith(p.sep) ? path : path + p.sep;
		const files = await fs.promises.readdir(fixedPath);
		const shorts = new Map();

		for(let i = 0, len = files.length; i < len; i++)
		{
			const file = files[i];

			const _short = generateShort(file);
			const _ext = generateExt(file);
			const key = _short+_ext;

			const num = (shorts.get(key) || 0) + 1;

			map.set(file, num);
			shorts.set(key, num);
		}

		shortSegment = short+'~'+map.get(segment)+(ext ? ext : '');

		if(CACHE_TIME)
		{
			scheduleCleanup();
		}
		else
		{
			shortSegmentCache.clear();
		}
	}

	return shortSegment;
}

function shortSegmentSync(path, segment)
{
	const now = Date.now();
	const short = generateShort(segment);
	const ext = generateExt(segment);

	let shortSegment;

	const _shortSegmentCache = getCache(shortSegmentCache, path);

	if(_shortSegmentCache)
	{
		shortSegment = short+'~'+_shortSegmentCache.get(segment)+(ext ? ext : '');
	}
	else
	{
		const map = new Map();
		setCache(shortSegmentCache, path, map);

		const fixedPath = path.endsWith(p.sep) ? path : path + p.sep;
		const files = fs.readdirSync(fixedPath);
		const shorts = new Map();

		for(let i = 0, len = files.length; i < len; i++)
		{
			const file = files[i];

			const _short = generateShort(file);
			const _ext = generateExt(file);
			const key = _short+_ext;

			const num = (shorts.get(key) || 0) + 1;

			map.set(file, num);
			shorts.set(key, num);
		}

		shortSegment = short+'~'+map.get(segment)+(ext ? ext : '');

		if(CACHE_TIME)
		{
			scheduleCleanup();
		}
		else
		{
			shortSegmentCache.clear();
		}
	}

	return shortSegment;
}

var existsCache = new Map();

function existsSync(path)
{
	const _exists = getCache(existsCache, path);
	if(_exists !== null) return _exists;

	const exists = fs.existsSync(path);
	setCache(existsCache, path, exists);

	return exists;
}

var statCache = new Map();

async function stat(path)
{
	const _stat = getCache(statCache, path);
	if(_stat !== null) return _stat;

	const stat = await fs.promises.stat(path);
	setCache(statCache, path, stat);

	return stat;
}

function statSync(path)
{
	const _stat = getCache(statCache, path);
	if(_stat !== null) return _stat;

	const stat = fs.statSync(path);
	setCache(statCache, path, stat);

	return stat;
}

async function validateShorted(original, shorted)
{
	if(existsSync(original) && existsSync(shorted))
	{
		const statOriginal = await stat(original);
		const statShorted = await stat(shorted);

		// Check if the shortened and original are the same file
		if(statOriginal.size === statShorted.size && statOriginal.ino === statShorted.ino && statOriginal.mtimeMs === statShorted.mtimeMs)
			return true;
	}

	return false;
}

function validateShortedSync(original, shorted)
{
	if(existsSync(original) && existsSync(shorted))
	{
		const statOriginal = statSync(original);
		const statShorted = statSync(shorted);

		// Check if the shortened and original are the same file
		if(statOriginal.size === statShorted.size && statOriginal.ino === statShorted.ino && statOriginal.mtimeMs === statShorted.mtimeMs)
			return true;
	}

	return false;
}

export function setCacheTime(time)
{
	CACHE_TIME = time;
}

var _getCache = new Map();

export async function get(path, force = false)
{
	if(process.platform !== 'win32') return path;

	const pathLength = path.length;

	if(pathLength >= 260 || force)
	{
		const cache = getCache(_getCache, path);
		if(cache) return cache;

		const command = `for %I in ("${path}") do @echo %~sI`;

		return new Promise(async function(resolve, reject) {

			exec(command, function(error, stdout, stderr) {

				if(error)
				{
					reject(error);
				}
				else if (stderr)
				{
					reject(stderr);
				}
				else
				{
					const newPath = stdout.trim();
					setCache(_getCache, path, newPath);
					resolve(newPath);
				}

			});

		});
	}

	return path;
}

var shortPathCache = new Map();

shortPathCache.set(false, new Map());
shortPathCache.set(true, new Map());

function getCache(map, key)
{
	if(!CACHE_TIME)
		return null;

	const cache = map.get(key);
	return cache && (Date.now() - cache[1] < CACHE_TIME) ? cache[0] : null;
}

function setCache(map, key, value)
{
	if(CACHE_TIME)
	{
		map.set(key, [value, Date.now()]);
		scheduleCleanup();
	}
}

export async function generate(path, force = false)
{
	if(process.platform !== 'win32') return path;

	const now = Date.now();
	const baseLength = path.length;
	let pathLength = baseLength;

	if(pathLength >= 260 || force)
	{
		const cachePath = getCache(shortPathCache.get(force), path);
		if(cachePath) return cachePath;

		const segments = splitPath(path);
		const len = segments.length;

		let newPath = segments[0];

		for(let i = 1; i < len; i++)
		{
			let segment = segments[i];
			const segmentLength = segment.length;

			if(segmentLength > 8 && (pathLength >= 260 || force) && existsSync(newPath))
			{
				const original = p.join(newPath, segment);
				const cachePathSegment = getCache(shortPathCache.get(force), original);

				if(!cachePathSegment)
				{
					segment = await shortSegment(newPath, segment);

					const shorted = p.join(newPath, segment);

					if(await validateShorted(original, shorted))
						newPath = shorted;
					else
						newPath = original;

					setCache(shortPathCache.get(force), original, newPath);
				}
				else
				{
					newPath = cachePathSegment;
				}

				pathLength = baseLength - (original.length - newPath.length);
			}
			else
			{
				newPath = p.join(newPath, segment);
			}
		}

		setCache(shortPathCache.get(force), path, newPath);

		return newPath;
	}

	return path;
}

export function generateSync(path, force = false)
{
	if(process.platform !== 'win32') return path;

	const now = Date.now();
	const baseLength = path.length;
	let pathLength = baseLength;

	if(pathLength >= 260 || force)
	{
		const cachePath = getCache(shortPathCache.get(force), path);
		if(cachePath) return cachePath;

		const segments = splitPath(path);
		const len = segments.length;

		let newPath = segments[0];

		for(let i = 1; i < len; i++)
		{
			let segment = segments[i];
			const segmentLength = segment.length;

			if(segmentLength > 8 && (pathLength >= 260 || force) && existsSync(newPath))
			{
				const original = p.join(newPath, segment);
				const cachePathSegment = getCache(shortPathCache.get(force), original);

				if(!cachePathSegment)
				{
					segment = shortSegmentSync(newPath, segment);

					const shorted = p.join(newPath, segment);

					if(validateShortedSync(original, shorted))
						newPath = shorted;
					else
						newPath = original;

					setCache(shortPathCache.get(force), original, newPath);
				}
				else
				{
					newPath = cachePathSegment;
				}

				pathLength = baseLength - (original.length - newPath.length);
			}
			else
			{
				newPath = p.join(newPath, segment);
			}
		}

		setCache(shortPathCache.get(force), path, newPath);

		return newPath;
	}

	return path;
}

function cleanup(map)
{
	const now = Date.now();
	const keys = map.keys();

	for(const key of keys)
	{
		const cache = map.get(key);

		if(now - cache[1] >= CACHE_TIME)
			map.delete(key);
	}
}

export const maps = [
	shortPathCache.get(false),
	shortPathCache.get(true),
	shortSegmentCache,
	existsCache,
	statCache,
	_getCache,
]

function _scheduleCleanup()
{
	let stillToDelete = false;

	for(const map of maps)
	{
		cleanup(map);

		if(map.size !== 0)
			stillToDelete = true;
	}

	timeout = false;

	if(stillToDelete)
		scheduleCleanup();
}

var timeout = false;

function scheduleCleanup()
{
	if(timeout === false)
		timeout = setTimeout(_scheduleCleanup, CACHE_TIME);
}
