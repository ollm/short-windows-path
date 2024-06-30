# short-windows-path

On Windows, this package tries to generate a short path using javascript, like `C:\Program Files (x86)\Windows Media Player\Media Renderer\DMR_120.png` to `C:\PROGRA~2\WINDOW~4\MEDIAR~1\DMR_120.png`. On other OS it returns the same path.

This can be used to bypass the 260 character limit on Windows by reducing the path length.

**Table of Contents**

- [Installation](#installation)
- [Methods](#methods)
  - [Simple example of package usage](#simple-example-of-package-usage)
  - [setCacheTime](#setcachetime)
  - [generate](#generate)
  - [generateSync](#sync)
  - [get](#get)

## Installation


```js
npm install short-windows-path
```

## Methods

This package can be used using CommonJS or ES Module.

```js
// CommonJS
const shortWindowsPath = require('short-windows-path');

// ES Module
import * as shortWindowsPath from 'short-windows-path';
```

### Simple example of package usage

```js
const fs = require('fs');
const p = require('path');
const shortWindowsPath = require('short-windows-path');

shortWindowsPath.setCacheTime(5000); // Milliseconds

// Using shortWindowsPath.generate
(async function(){

	const files = await fs.promises.readdir('C:\\Program Files (x86)');

	let shortened = {};
	console.time('shortWindowsPath.generate');

	for(let key in files)
	{
		const file = files[key];
		const path = p.join('C:\\Program Files (x86)', file);

		let shortPath = await shortWindowsPath.generate(path, true);
		shortened[path] = shortPath;
	}

	console.timeEnd('shortWindowsPath.generate');
	console.log(shortened);

})();

// Using shortWindowsPath.generateSync
(function(){

	const files = fs.readdirSync('C:\\Program Files (x86)');

	let shortened = {};
	console.time('shortWindowsPath.generateSync');

	for(let key in files)
	{
		const file = files[key];
		const path = p.join('C:\\Program Files (x86)', file);

		let shortPath = shortWindowsPath.generateSync(path, true);
		shortened[path] = shortPath;
	}

	console.timeEnd('shortWindowsPath.generateSync');
	console.log(shortened);

})();

// Using shortWindowsPath.get
(async function(){

	const files = await fs.promises.readdir('C:\\Program Files (x86)');

	let shortened = {};
	console.time('shortWindowsPath.get');

	for(let key in files)
	{
		const file = files[key];
		const path = p.join('C:\\Program Files (x86)', file);

		let shortPath = await shortWindowsPath.get(path, true);
		shortened[path] = shortPath;
	}

	console.timeEnd('shortWindowsPath.get');
	console.log(shortened);

})();

```

### setCacheTime

Set the cache time, some data is cached to optimize the generation of the short path and reduce disk reads, the cache can produce unexpected results in some cases if it is being written to the folder.

```js
const shortPath = shortWindowsPath.setCacheTime(Int time = 10000);
```
-  __time__ Cache time in milliseconds.

### generate

Try to generate the short path and check that it exists, this method is faster than `shortWindowsPath.get` but may not get the short path for some folder/files, also uses various read functions to generate the path (`fs.promises.readdir`, `fs.promises.stat` and `fs.existsSync`)

```js
const shortPath = await shortWindowsPath.generate(String path, Boolean force = false);
```

-  __force__ Force the sort path generation, by default the short path it is only generated if the path is equal or greater than 260 characters and it will stop generating when the path is below.

### generateSync

Try to generate the short path and check that it exists synchronously, this method is faster than `shortWindowsPath.get` but may not get the short path for some folder/files, also uses various read functions to generate the path (`fs.readdir`, `fs.stat` and `fs.existsSync`)

```js
const shortPath = shortWindowsPath.generateSync(String path, Boolean force = false);
```
-  __force__ Force the sort path generation, by default the short path it is only generated if the path is equal or greater than 260 characters and it will stop generating when the path is below.

### get

Get the shorten path using the command `for %I in ("path") do @echo %~sI`, this can be slower that other methods but it will return the correct short path.

```js
const shortPath = await shortWindowsPath.get(String path, Boolean force = false);
```

-  __force__ Force the sort path generation, by default the short path it is only generated if the path is equal or greater than 260 characters.