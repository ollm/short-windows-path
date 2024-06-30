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
	const first = extract(/^([\\\/]*[^\\\/]+)[\\\/]*/, path);
	const segments = path.replace(/^([\\\/]*[^\\\/]+)[\\\/]*/, '').split(p.sep).filter(i => i);

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

var shortSegmentCache = {};

async function shortSegment(path, segment)
{
	const now = Date.now();
	const short = generateShort(segment);
	const ext = generateExt(segment);

	let shortSegment;

	if(CACHE_TIME && shortSegmentCache[path])
	{
		shortSegment = short+'~'+shortSegmentCache[path][segment]+(ext ? ext : '');
	}
	else
	{
		shortSegmentCache[path] = {};

		const files = await fs.promises.readdir(path);
		const shorts = {};

		for(let i = 0, len = files.length; i < len; i++)
		{
			const file = files[i];

			const _short = generateShort(file);
			const _ext = generateExt(file);
			const key = _short+_ext;

			if(!shorts[key]) shorts[key] = 1;
			shortSegmentCache[path][file] = shorts[key];
			shorts[key]++;
		}

		shortSegment = short+'~'+shortSegmentCache[path][segment]+(ext ? ext : '');

		if(CACHE_TIME)
		{
			setTimeout(function(){

				delete shortSegmentCache[path];

			}, CACHE_TIME);
		}
		else
		{
			shortSegmentCache = {};
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

	if(CACHE_TIME && shortSegmentCache[path])
	{
		shortSegment = short+'~'+shortSegmentCache[path][segment]+(ext ? ext : '');
	}
	else
	{
		shortSegmentCache[path] = {};

		const files = fs.readdirSync(path);
		const shorts = {};

		for(let i = 0, len = files.length; i < len; i++)
		{
			const file = files[i];

			const _short = generateShort(file);
			const _ext = generateExt(file);
			const key = _short+_ext;

			if(!shorts[key]) shorts[key] = 1;
			shortSegmentCache[path][file] = shorts[key];
			shorts[key]++;
		}

		shortSegment = short+'~'+shortSegmentCache[path][segment]+(ext ? ext : '');

		if(CACHE_TIME)
		{
			setTimeout(function(){

				delete shortSegmentCache[path];

			}, CACHE_TIME);
		}
		else
		{
			shortSegmentCache = {};
		}
	}

	return shortSegment;
}

var existsCache = {};

function existsSync(path)
{
	if(existsCache[path] !== undefined) return existsCache[path];

	const exists = fs.existsSync(path);

	if(CACHE_TIME)
	{
		existsCache[path] = exists;

		setTimeout(function(){

			delete existsCache[path];

		}, CACHE_TIME);
	}

	return exists;
}

var statCache = {};

function statSync(path)
{
	if(statCache[path] !== undefined) return statCache[path];

	const stat = fs.statSync(path);

	if(CACHE_TIME)
	{
		statCache[path] = stat;

		setTimeout(function(){

			delete statCache[path];

		}, CACHE_TIME);
	}

	return stat;
}

async function stat(path)
{
	if(statCache[path] !== undefined) return statCache[path];

	const stat = await fs.promises.stat(path);

	if(CACHE_TIME)
	{
		statCache[path] = stat;

		setTimeout(function(){

			delete statCache[path];

		}, CACHE_TIME);
	}

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

var getCache = {};

export async function get(path, force = false)
{
	let pathLength = path.length;

	if((pathLength >= 260 || force) && process.platform == 'win32')
	{
		if(CACHE_TIME && getCache[path]) return getCache[path];

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
					
					if(CACHE_TIME)
					{
						getCache[path] = newPath;

						setTimeout(function(){

							delete getCache[path];

						}, CACHE_TIME);
					}

					resolve(newPath);
				}

			});

		});
	}

	return path;
}

var shortPathCache = {};

export async function generate(path, force = false)
{
	let pathLength = path.length;

	if((pathLength >= 260 || force) && process.platform == 'win32')
	{
		if(CACHE_TIME && !shortPathCache[force]) shortPathCache[force] = {};
		if(CACHE_TIME && shortPathCache[force][path]) return shortPathCache[force][path];

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
				if(!CACHE_TIME || !shortPathCache[force][original])
				{
					segment = await shortSegment(newPath, segment);
					pathLength -= segmentLength - segment.length;

					const shorted = p.join(newPath, segment);

					if(await validateShorted(original, shorted))
						newPath = shorted;
					else
						newPath = original;

					if(CACHE_TIME)
					{
						shortPathCache[force][original] = newPath;

						setTimeout(function(){

							delete shortPathCache[force][original];

						}, CACHE_TIME);
					}
				}
				else
				{
					newPath = shortPathCache[force][original];
				}
			}
			else
			{
				newPath = p.join(newPath, segment);
			}
		}

		if(CACHE_TIME)
		{
			shortPathCache[force][path] = newPath;

			setTimeout(function(){

				delete shortPathCache[force][path];

			}, CACHE_TIME);
		}

		return newPath;
	}

	return path;
}

export function generateSync(path, force = false)
{
	let pathLength = path.length;

	if((pathLength >= 260 || force) && process.platform == 'win32')
	{
		if(CACHE_TIME && !shortPathCache[force]) shortPathCache[force] = {};
		if(CACHE_TIME && shortPathCache[force][path]) return shortPathCache[force][path];

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
				if(!CACHE_TIME || !shortPathCache[force][original])
				{
					segment = shortSegmentSync(newPath, segment);
					pathLength -= segmentLength - segment.length;

					const shorted = p.join(newPath, segment);

					if(validateShortedSync(original, shorted))
						newPath = shorted;
					else
						newPath = original;

					if(CACHE_TIME)
					{
						shortPathCache[force][original] = newPath;

						setTimeout(function(){

							delete shortPathCache[force][original];

						}, CACHE_TIME);
					}
				}
				else
				{
					newPath = shortPathCache[force][original];
				}
			}
			else
			{
				newPath = p.join(newPath, segment);
			}
		}

		if(CACHE_TIME)
		{
			shortPathCache[force][path] = newPath;

			setTimeout(function(){

				delete shortPathCache[force][path];

			}, CACHE_TIME);
		}

		return newPath;
	}

	return path;
}