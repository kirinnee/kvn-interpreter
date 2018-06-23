/*
 * Compiling sequence for KVN engine by Kirinnee97
 * Please refer any questions, bugs and copyright issue to https://bigbulb.studio or email me at kirinnee97@gmail.com
 * THANK YOU SO MUCH <3
 */
var gulp = require('gulp');
var fs = require('fs');
const del = require('del');
var TreeNode = require('./interpreter/tree');
var Method = require('./interpreter/method');
var Args = require('./interpreter/arg');
var Lexer = require('./interpreter/lexer');
var Lexer2 = require('./interpreter/lexer2');
var Parser = require('./interpreter/parser');
var Variable = require('./interpreter/variables');
var GameObject = require('./interpreter/gameobj');
var Macro = require('./interpreter/marco');
var Tree = require('./interpreter/simplertree');
var Construct = require('./interpreter/constructor');

function numberOfSpaces(text) {
	var count = 0;
	var index = 0;
	while (text.charAt(index++) === " ") {
		count++;
	}
	return count;
}
//compile
gulp.task('series', function(done) {
	var config = fs.readFileSync('../kvn/config.js');
	var scripts = eval(config + 'scripts');
	var promises = [];
	for (var x in scripts) {
		var script = scripts[x];
		let os = script;
		script = script.replace('.js', '.kvn');
		var p = new Promise(function(resolve, reject) {
			fs.readFile('../kvn/scripts/' + script, 'utf8', function(err, data) {
				if (err)
					throw err;
				var lines = data.split("\n")
					.map((d, i) => {
						return {
							index: i + 1,
							code: d
						}
					})
					.map(d => {
						d.code = d.code.replace(/\t/g, '    ');
						return d;
					})
					.filter(d => d.code !== null && typeof d.code === "string" && d.code.trim() !== "")
					//strip comments
					.map(d => stripSingleComments(d))
					.filter(d => d.code !== null && typeof d.code === "string" && d.code.trim() !== "")
				try {
					var ret = parseDefintions(lines);
					lines = ret[0];
					var objList = ret[1]; //obtain object tree
					var varList = ret[2]; //obtain var tree
					ret = registerMacro(lines);
					lines = ret[0];
					var marcoList = ret[1]; //obtain macro list
					var codeTree = parseScenes(lines); //obtain true code tree
					//console.log(codeTree.getTreeView());
					var ex = initAllMethods({}, {}, {});
					var parser = new Parser(codeTree, marcoList, objList, ex[0], ex[1], ex[2], varList);
					var js = parser.parse();
					var tree = beautify(js);
					var codes = tree.travse([]);
					var pp = codes.join('\n');
					fs.writeFile("../kvn/scripts/" + os, pp, function(err) {
						if (err) {
							return console.log(err);
						}
						resolve();
					});
				} catch (e) {
					console.log("Caught Error in File ", script + ": ", e.stack)
					var x = 'displayError(\'Caught Error in File ' + script + ': ' + e + "');";
					fs.writeFile("../kvn/scripts/" + os, x, function(err) {
						if (err) {
							return console.log(err);
						}
						resolve();
					});
				}
			});
		});
		promises.push(p);
	}
	return Promise.all(promises);
});

function parseScenes(lines) {
	var codeTree = new TreeNode(-2, "CodeRoot", "none");
	var latestNode = codeTree;
	var latestScene = null;
	var hasFrame = false;
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].code;
		var index = lines[i].index;
		var s = numberOfSpaces(line);
		if (s === 0) {
			if (line.substring(0, 5).trim() === "frame") {
				var frame = new TreeNode(0, line.trim(), index);
				if (latestScene === null) {
					throw new Error("Cannot find scene to add to!");
				}
				latestScene.add(frame);
				latestNode = frame;
				hasFrame = true;
			} else if (line.substring(0, 5).trim() === "scene") {
				var scene = new TreeNode(-1, line.trim(), index);
				codeTree.add(scene);
				latestScene = scene;
			} else if (line.substring(0, 6).trim() === "create") {
				var create = new TreeNode(0, line.trim(), index);
				codeTree.add(create);
				latestNode = create;
			} else if (line.substring(0, 5).trim() === "start") {
				var create = new TreeNode(0, line.trim(), index);
				codeTree.add(create);
				latestNode = create;
			} else {
				codeTree.add(new TreeNode(0, line.trim(), index));
			}
		} else {
			if (!hasFrame && latestNode.getKey() !== "create" && latestNode.getKey() !== "start") {

				continue;
			}
			var code = new TreeNode(s, line.trim(), index);
			if (s > latestNode.value) {
				latestNode.add(code);
			} else if (s === latestNode.value) {
				latestNode.parent.add(code);
			} else {
				while (s < latestNode.value) {
					latestNode = latestNode.parent;
				}
				if (s > latestNode.value) {
					latestNode.add(code);
				} else if (s === latestNode.value) {
					latestNode.parent.add(code);
				} else {
					throw new Error("Tree Traversal Failed");
				}
			}
			latestNode = code;
		}
	}
	return codeTree;
}

function beautify(data) {
	var lines = data.split('\n')
		.filter(d => d !== null && typeof d === "string" && d.trim() !== "")
	var rootNode = new Tree("root", -1);
	var latestNode = rootNode;
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var s = numberOfSpaces(line);
		var code = new Tree(line.trim(), s);
		if (s > latestNode.value) {
			latestNode.add(code);
		} else if (s === latestNode.value) {
			latestNode.parent.add(code);
		} else {
			while (s < latestNode.value) {
				latestNode = latestNode.parent;
			}
			if (s > latestNode.value) {
				latestNode.add(code);
			} else if (s === latestNode.value) {
				latestNode.parent.add(code);
			} else {
				throw new Error("Tree Traversal Failed");
			}
		}
		latestNode = code;
	}
	return rootNode;
}

function addMethodToList(method, list) {
	var arr = method.alias;
	arr.push(method.key);
	for (var x in arr) {
		list[arr[x]] = method;
	}
	return list;
}

function initConstructor(conList) {
	var lex = new Lexer();
	var c = 'Constructor';
	var id = new Args('id', [], 'string', 'unique-string',
		"The ID of the object. This string has to be unique, no 2 objects can have the same ID", {
			'unique-string': 'any string that has not been used before'
		}
	)
	var name = new Args('name', ['n'], 'string', 'string',
		"The name of the character when he/she speaks", {
			'string': 'Any string. Eg: John, Mother, Kami-sama'
		}
	)
	var image = new Args('image', ['sprite', 'defImage', 'defSprite'], 'string', 'URL',
		"Link to the default sprite the character is rendered with. This is anaimage link to the folder kvn/images/char/ folder by default", {
			'string': 'The relative link to the image. Eg: sophie.png, chelsea/cry.jpg'
		}
	)
	var width = new Args('width', ['w'], 'number', '!0+number',
		"The width of the character in terms of percentage of the VN's screen's width*", {
			'number': 'Non 0 positive number. Eg: 1, 12, 55.5, 7+8 , 6*7.7'
		}
	)
	var height = new Args('height', ['h'], 'number', '!0+number',
		"The height of the character in terms of percentage of the VN's screen's width*", {
			'number': 'Non 0 positive number. Eg: 1, 12, 55.5, 7+8 , 6*7.7'
		}
	)
	var x = new Args('xOffSet', ['x', 'xOffset', 'left'], 'number', 'number',
		"The horizontal distance the character will be at from the alignment of the character in terms of percentage of the VN's screen width.", {
			"number": "Any float or integer"
		}
	)
	var y = new Args('yOffSet', ['y', 'yOffset', 'top'], 'number', 'number',
		"The vertical distance the character will be at from the alignment of the character in terms of percentage of the VN's screen height.", {
			"number": "Any float or integer"
		}
	)
	var aX = new Args('horizontalAlignment', ['aX', 'xAlign', 'hAlign'], 'number', 'number',
		"This is BOTH the anchor x of the character AND the character's hozizontal aligment to the screen.", {
			"number": "Any float or integer"
		}
	)
	var aY = new Args('verticalAlignment', ['aY', 'yAlign', 'vAlign'], 'number', 'number',
		"This is BOTH the anchor y of the character AND the character's vertical aligment to the screen.", {
			"number": "Any float or integer"
		}
	)
	var bgi = new Args('image', ['sprite', 'defImage', 'defSprite', 'bg', 'background', 'bkgd'], 'string', 'URL',
		"Link to the default background image the stage is rendered with. This is an image link to the folder kvn/images/bkgd/ folder by default", {
			'string': 'The relative link to the image. Eg: town.png, chinatown/rain.jpg'
		}
	)
	var opText = new Args('text', ['msg', 'option'], 'string', 'string',
		"The text that is displayed as the option.", {
			'string': 'Any string'
		}
	)
	var promise = new Args('promise', [], 'function', 'promise',
		'A promise to be fulfilled. This is a function, when this animation or instant ends (whether skipped or not), the promise will be executed.', {
			'function': 'a full defined javacsript function. This can be other animations, setters or anything at all.',
			'null/undefined': 'Ends the animation thread. When all animation thread ends in aframe, the frame will be considered to have ended.'
		});
	var soundgroup = new Args('soundgroup', [], 'object', 'sound-group',
		'The master sound group which this sound belongs to, when the volume of this sound group changes, all the sound belonging to this sound group will change relatively. ', {
			'VN': 'Visual Novel sounds, including visual novel background music',
			'BGM': 'Clicker Background music',
			'SFX': 'Sound effects for clicker'
		}
	)
	var source = new Args('source', [], 'string', 'URL',
		'Source of the sound. Recommended to use mp3 to fit all browsers. Note that is has to be under /sounds folder ', {
			'string': 'Relative link to sound/music files. Eg:background.mp3, title.wav, kimi.flac'
		}
	)
	var loop = new Args('loop', [], 'boolean', 'boolean',
		'Whether the sound will loop after it has ended', {
			'true': 'Sound automatically loops after ended',
			'false': 'Sound stops playing once it reaches the end of its playback',
			'null/undefined': 'Sound will stop playing once it reaches the end of its playback'
		}
	)
	addMethodToList(new Construct('character', [], 'Character', [name, image, width, height, x, y, aX, aY], lex, c,
		'Creates a Character Object'
	), conList);
	addMethodToList(new Construct('stage', [], 'Stage', [bgi], lex, c,
		'Creates a Stage Object'
	), conList);
	addMethodToList(new Construct('option', [], 'Options', [opText,id, promise], lex, c,
		'Creates a Option Object'
	), conList);
	addMethodToList(new Construct('sound', [], 'GameSound', [soundgroup, source, loop], lex, c,
		'Creates a Sound Object'
	), conList);
	return conList;
}

function initCharacter(charList) {
	var lex = new Lexer();
	var lexer = new Lexer2();
	//animation
	var prior = 'Reset this value to prior to .complete() call for the character. See character-defaults';
	var cc = "Chain Constructor";
	var set = "Setter";
	var anim = "Animation";
	var panim = "Pre Animations";
	var inst = "Instants";
	var fr = "Frills";
	var o = "Others";
	var dir = new Args('directory', ['dir'], 'string', 'URL',
		'Directory which contains the sprite for this character. Can be online URL.', {
			'string': 'directory to point to',
			'def/null/undefined': 'character folder in images in kvn folder'
		});
	var dskip = new Args('skip', [], 'boolean', 'boolean',
		'By default, whether the character\'s animations can be skipped (if the skip argument is not supplied)', {
			'true': 'Character\'s animation can be skipped unless specified at animation level. This does not affect for "wait" method',
			'false': 'Character\'s animations cannot be skipped unless the specified at animation level.',
			'null/undefined': prior,
			'def': 'Makes the character animation skip-able unless specified at animation level'
		});
	var scaleV = new Args('scale', [], 'number', '+number',
		'The factor to scale by before the character speaks using the preSpeak method.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'null/undefined': prior,
			'def': '1.05'
		});
	var spsTime = new Args('time', ['t'], 'number', '+int',
		'The amount of time in milliseconds the character take to scale when using the preSpeak method.', {
			'number': 'Any non negative integer. Zero would make it instant. Eg: 100 (0.1s), 2000 (2s)',
			'null/undefined': prior,
			'def': '200'
		});
	var spriteName = new Args('spriteName', ['name'], 'string', 'string',
		'The name of the sprite.', {
			'string': 'Any string. Preferable without spaces or special character. Eg: sad, smile_speak'
		});
	var spritePath = new Args('spritePath', ['sprite', 'path'], 'string', 'URL',
		'The path to the sprite (image). Do include file extension. The default image folder is "images/char". Sprites links can include relative resource locations. ', {
			'string': 'Any legit URL that points to an image within the folder (or preset directory). Eg: sophie.png, chelsea/cry.png'
		});
	var fontSize = new Args('fontSize', ['textSize', 'fs'], 'string', 'font-size',
		'The font size when the character speaks.', {
			'html units': 'Any number with a html unit. Eg: 1.5vw, 20px, 5vh, 7%, 8.33em.',
			'null/undefined': prior,
			'def': '1.5vw'
		});
	var bold = new Args('bold', [], 'boolean', 'boolean',
		'Whether the character\'s text will be bold.', {
			'true': 'Character text will be bold',
			'false': 'Character text will not be bold',
			'null/undefined': prior,
			'def': 'false'
		});
	var italic = new Args('italic', [], 'boolean', 'boolean',
		'Whether the character\'s text will be italic.', {
			'true': 'Character text will be italic',
			'false': 'Character text will not be italic',
			'null/undefined': prior,
			'def': 'false'
		});
	var color = new Args('color', ['colour', 'yanse'], 'string', 'color',
		'Character\'s text/font color. ', {
			"6-hex": "6 Digit hexidecimal Color code. Example: #00FF00",
			"3-hex": "3 Digit hexidecimal Color code. Example: #FA3",
			"RGBA": "RedGreenBlueAlpha values between 0-255. Eg: rgba(0,0,254,0.5)",
			"HTML presets": "List of HTML preset colors. Eg: black, green, blue, red, yellow, aqua",
			"null/undefined": prior,
			"def": "black"
		});
	var opacity = new Args('opacity', ['o', 'a', 'alpha'], 'number', 'float',
		'Opacity of the character.', {
			'float': 'decimals between 0 and 1 inclusive, where 0 is completely transparent and 1 is completely opaque. Eg: 0.5, 0.66, 1',
			'null/undefined': prior,
			'def': '0'
		});
	var anchorX = new Args('anchorX', ['x', 'aX', 'xOrigin', 'originX'], 'number', 'number',
		'The X or Horizontal Anchor of the Character. See alignment and anchoring.', {
			'number': 'Any number between 0 and 100, where 0 will be the extreme left and 100 will be the extreme right. 50 would be the horizontal center of the Character.',
			'null/undefined': prior,
			'def': '0'
		});
	var anchorY = new Args('anchorY', ['y', 'aY', 'yOrigin', 'originY'], 'number', 'number',
		'The Y or Vertical Anchor of the Character. See alignment and anchoring.', {
			'number': 'Any number between 0 and 100, where 0 will be the extreme top and 100 will be the extreme bottom. 50 would be the vertical center of the Character.',
			'null/undefined': prior,
			'def': '0'
		});
	var hAlign = new Args('xAlign', ['hAlign', 'x', 'alignX', 'horizontalAlign'], 'number', 'number',
		'The horizontal alignment of the Character. See alignment and anchoring.', {
			'number': 'Any number between 0 and 100, where 0 will be the extreme left of the screen and  100 will be the extreme right. 50 would be the horizontal center of the VN Screen.',
			'null/undefined': prior,
			'def': '0'
		});
	var vAlign = new Args('yAlign', ['vAlign', 'y', 'alignY', 'verticalAlign'], 'number', 'number',
		'The vertical alignment of the Character. See alignment and anchoring.', {
			'number': 'Any number between 0 and 100, where 0 will be the extreme top of the screen and  100 will be the extreme bottom. 50 would be the vertical center of the VN Screen.',
			'null/undefined': prior,
			'def': '0'
		});
	var adjust = new Args('adjust', [], 'boolean', 'boolean',
		'Whether to adjust the offset of the character so that the character will not move. This is true by default.', {
			'true': 'engine would auto offset the character such that the character on screen will not move ',
			'false': 'engine would animate the character to the new position due to the change in anchor or alignment',
			'def/null/undefined': 'true'
		});
	var xArg = new Args('x', ['xPos', 'left', 'xOffset'], 'number', 'number',
		'The horizontal (or x) offset of the character.', {
			'number': 'Any real number. It is in percentage of VN Engine\'s screen width. Ie 5 is 5% of the VN Engine Screen width to the right, whereas -8.55 is -8.55% of the VN Engine Screen width to the left. ',
			'null/undefined': prior,
			'def': 0
		});
	var yArg = new Args('y', ['yPos', 'top', 'yOffset'], 'number', 'number',
		'The vertical (or y) offset of the character.', {
			'number': 'Any real number. It is in percentage of VN Engine\'s screen height. Ie 5 is 5% of the VN Engine Screen height downwards, whereas -8.55 is -8.55% of the VN Engine Screen height upwards. ',
			'null/undefined': prior,
			'def': 0
		});
	var hflip = new Args('hflip', ['horizontalFlip'], 'boolean', 'boolean',
		'Whether the character is flipped horizontally (along the y axis, on the x axis)', {
			'true': 'The character is flipped horizontally',
			'false': 'The character is not flipped horizontally',
			'null/undefined': prior,
			'def': 'The character is not flipped horizontally'
		});
	var vflip = new Args('vflip', ['verticalFlip'], 'boolean', 'boolean',
		'Whether the character is flipped vertically (along the x axis, on the y axis)', {
			'true': 'The character is flipped vertically',
			'false': 'The character is not flipped vertically',
			'null/undefined': prior,
			'def': 'The character is not flipped vertically'
		});
	var width = new Args('width', ['w'], 'number', '!0+number',
		'The width the character. This is in percentage of the screen width*.', {
			'number': 'Non-negative, non-zero number. Eg: 5, 75.5',
			'null/undefined/def': prior
		});
	var height = new Args('height', ['h'], 'number', '!0+number',
		'The height the character. This is in percentage of the screen width* (To be able to preserve aspect ratio).', {
			'number': 'Non-negative, non-zero number. Eg: 5, 75.5',
			'null/undefined/def': prior
		});
	var sepia = new Args('sepia', ['filter', 'f'], 'number', 'float',
		'How sepia the character is, where 0 is no sepia filter and 1 is maximum sepia filter', {
			'number': 'Any floating point between 0 and 1. Eg: 0.5, 0, 0.224',
			'null/undefined': prior,
			'def': '0'
		});
	var invert = new Args('invert', ['filter', 'f', 'negative'], 'number', 'float',
		'How negative the character color is, where 0 is no negative filter and 1 iis when the character is compeletely inverted. At 0.5, the character will be completely grey.', {
			'number': 'Any floating point between 0 and 1. Eg: 0.5, 0, 0.224',
			'null/undefined': prior,
			'def': '0'
		});
	var blur = new Args('blur', ['filter', 'f'], 'number', 'float',
		'How blur the character is, where at 0 the character is clear and 1 is very blur. You can exceed the value 1 but its is not recommended', {
			'number': 'Any floating point between 0 and 1. Eg: 0.5, 0, 0.224',
			'null/undefined': prior,
			'def': '0'
		});
	var contrast = new Args('contrast', ['filter', 'f'], 'number', 'float',
		'How much contrast to apply to the character is, where 1 is normal, values between 0-1 will decrease contrast while values above 1 will increase the contrast', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 3.6',
			'null/undefined': prior,
			'def': '1'
		});
	var saturate = new Args('saturation', ['filter', 'f', 'saturate'], 'number', 'float',
		'How saturated the character is, where 1 is no saturation. Sub 1 is undersaturation and values above one will increase the saturation.', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 3.6',
			'null/undefined': prior,
			'def': '1'
		});
	var grayscale = new Args('grayscale', ['filter', 'gray'], 'number', 'float',
		'How close to black and white (grayscale) the character is. 1 is fully gray-scaled.', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 1',
			'null/undefined': prior,
			'def': '0'
		});
	var bright = new Args('brightness', ['filter', 'f', 'bright'], 'number', 'float',
		'How bright the character is, where 1 is the normal brightness. Sub 1 is darken the character and values above one will increase the character brightness.', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 3.6',
			'null/undefined': prior,
			'def': '1'
		});
	var huerotation = new Args('angle', ['filter', 'f', 'rotate', 'rotation'], 'number', 'degree',
		'Hue rotation of the character is.', {
			'degree': 'Any degree between 0-360. Larger or smaller values will loop back.',
			'null/undefined': prior,
			'def': '0'
		});
	var angle = new Args('angle', ['degree', 'rotate', 'rotation'], 'number', 'degree',
		'Rotation of the character clockwise in degrees', {
			'degree': 'Any number between 0-360. Larger or smaller values will loop back.',
			'null/undefined': prior,
			'def': '0'
		});
	var skewX = new Args('xSkew', ['x', 'angleX', 'skewX'], 'number', 'degree',
		'How many degrees the character is skewed horizontally', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'null/undefined': prior,
			'def': '0'
		});
	var skewY = new Args('ySkew', ['y', 'angleY', 'skewY'], 'number', 'degree',
		'How many degrees the character is skewed vertically', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'null/undefined': prior,
			'def': '0'
		});
	var scaleX = new Args('scaleX', ['x', 'xScale', 'w', 'width'], 'number', '+number',
		'The factor to scale horizontally (width) by.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'null/undefined': 'Original width of character',
			'def': '1.2'
		});
	var scaleY = new Args('scaleY', ['y', 'yScale', 'height', 'h'], 'number', '+number',
		'The factor to scale vertically (height) by.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'null/undefined': 'Original height of character',
			'def': '1.2'
		});
	var moveX = new Args('x', ['left', 'xPos'], 'number', 'number',
		'The amount to move the character horizontally by. This is in percentage of the VN screen width. Positive is to the right where as negative is to the left.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'def/null/undefined': 'Original x position of the character'
		});
	var moveY = new Args('y', ['top', 'yPos'], 'number', 'number',
		'The amount to move the character vertically by. This is in percentage of the VN screen height. Positive is downwards where as negative is upwards.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'def/null/undefined': 'Original y position of the character'
		});
	var angleCW = new Args('angle', ['degree', 'rotate', 'rotation'], '+number', 'degree',
		'Rotation of the character clockwise in degrees. Only positive numbers', {
			'degree': 'Any number between 0-360. Larger values will loop back.',
			'null/undefined': 'Rotates the character back to normal.',
			'def': '45'
		});
	var angleACW = new Args('angle', ['degree', 'rotate', 'rotation'], '+number', 'degree',
		'Rotation of the character anti-clockwise in degrees. Only positive numbers', {
			'degree': 'Any number between 0-360. Larger values will loop back.',
			'null/undefined': 'Rotates the character back to normal.',
			'def': '45'
		});
	var XSkew = new Args('xSkew', ['x', 'angleX', 'skewX'], 'number', 'degree',
		'How many degrees the character is skewed horizontally', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'null/undefined': 'Unskews the character back to normal.',
			'def': '45'
		});
	var YSkew = new Args('ySkew', ['y', 'angleY', 'skewY'], 'number', 'degree',
		'How many degrees the character is skewed vertically', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'null/undefined': 'Unskews the character back to normal.',
			'def': '45'
		});
	var text = new Args('text', ['msg'], 'string', 'string',
		'The text the character will say.', {
			'string': 'Any valid string. Do note that if it is too long it will clip out of the text box'
		});
	var texttime = new Args('time', ['t'], 'number', '+int',
		'Time taken for the character to say finish the sentence in milliseconds. If this number is too low, it will revert to 10ms between each character.', {
			'number': 'Any non-zero positive integer. This is the number of milliseconds.',
			'def/null/undefined': 'each character will appear every 20 milliseconds (normal scrolling speed)'
		}
	);
	var newLine = new Args('newLine', ['nl', 'ln', 'linebreak', 'br'], 'boolean', 'boolean',
		'When continue speaking, whether the text appears on a new line.', {
			'true': 'text appears on a new line',
			'false': 'text appears on the same line as the previous text',
			'null/def/undefined': 'text appears on the same line as previous text'
		}
	);
	var appendSpace = new Args('appendSpace', ['append', 'space'], 'boolean', 'boolean',
		'When continue speaking, whether to add a space before displaying the text. Default is true. ( will add space by default)', {
			'true': 'prepends a space before displaying the text. ',
			'false': 'does not prepend a space before displaying the text',
			'null/def/undefined': 'prepends a psace before displaying the text'
		}
	);
	//common animations
	var promise = new Args('promise', [], 'function', 'promise',
		'A promise to be fulfilled. This is a function, when this animation or instant ends (whether skipped or not), the promise will be executed.', {
			'function': 'a full defined javacsript function. This can be other animations, setters or anything at all.',
			'null/undefined': 'Ends the animation thread. When all animation thread ends in aframe, the frame will be considered to have ended.'
		});
	var time = new Args('time', ['t'], 'number', '+int',
		'How much time to complete the animation or instant in milliseconds. 0 will make it animate to it end-state instantly ', {
			'number': 'Positive integers in milliseconds.',
			'null/undefined': '0',
			'def': '500'
		});
	var swing = new Args('graph', ['g'], 'object', 'animation-graph',
		'The animation interpolation type', {
			'linear': 'normal',
			'swing': 'slow-fast-slow',
			'easeIn': 'slow->fast',
			'easeOut': 'fast->slow',
			'easeBack': 'fast till exceed -> slowly go back to correct position',
			'elastic': 'rubberband effect',
			'bounce': 'like ball bouncing',
			'slowMotion': 'slow motion effect',
			'stepped': 'Not continous, jagged. Stepped function',
			'rough': 'random sharp jumps',
			'null/undefined': 'The character default animation-interpolation policy. To change check the method setDefaultAnimationInterpolation',
			'def': 'swing'
		});
	var skip = new Args('skip', ['s'], 'boolean', 'boolean',
		'Whether this animation can be skipped by clicking', {
			'true': 'This animation can be skipped by clicking',
			'false': 'This animation cannot be skipped by clicking',
			'null/undefined': 'The character default policy regarding animation skip-ablity. To change check the method setDefaultSkippable.'
		});
	var shake = new Args('shake', [], 'number', '+number',
		'The percentage of the character to shake by. 1 would be 1% of the character\'s width and height, and 0.5 would be 0.5% of the character\'s width and height. ', {
			'number': 'Any non-zero positive float or integer',
			'null/def/undefined': 'shake the character by 0.5%'
		});
	var delay = new Args('delay', [], 'number', '!0+int',
		'Shaking can be seen as a frame of shifting the character. The delay is the time between each change in position. Default value is 25 (undefined/null/def).', {
			'number': 'time in milliseconds. Only non-zero positive integers',
			'null/def/undefined': '25'
		});
	var gameInstance = new Args('gameInstant', ['char', 'bg', 'character', 'background', 'instance'], 'object', 'game-instance',
		'Stage or Character', {
			'stage': 'Fully constructed Stage Object',
			'character': 'Fully constructed Character Object'
		}
	);
	var name = new Args('name', [], 'string', 'string',
		'Name of to be displayed as speaking for the character', {
			'string': 'Any string to be displayed as name. Eg: John Smith, Kami-sama',
			'none': 'Will not display the name box',
			'def': 'Will not display the name box',
			'null/undefined': 'character\'s default name during construction'
		}
	);
	addMethodToList(
		new Method('changeName', [], null, [name], lexer, set,
			"Changes the display name of the character",
		), charList);
	//Chain Constructors
	addMethodToList(
		new Method('complete', [], 'complete', [], lex, "Chain Constructor", "Marks the completion of the character during construction. All values set by chain constructors, setters or pre-anim prior to this method call will be set as the character's default values. When calling settings and animations, if the parameter is undefined or null, it will assume to animate to/set to these default values"), charList);
	addMethodToList(
		new Method('setCustomDirectory', ['setDir'], 'setCustomDirectory', [dir], lex, cc,
			"Changes the default sprite directory to any directory (can be CDN or URL)"
		), charList);
	addMethodToList(new Method('setDefaultSkippable', ['setDefSkip'], null, [dskip], lexer, "Chain Constructor",
		"Boolean value. Changes whether character animation can be skipped by default (when animation does not specify the animation skip-ability). "
	), charList);
	addMethodToList(new Method('setPreSpeakScale', [], null, [scaleV], lexer, cc,
		"Sets the default value for the 'preSpeak' method for scaling the character"), charList);
	addMethodToList(new Method('setPreSpeakTime', [], null, [spsTime], lexer, cc,
		"Set the default time taken for the 'preSpeak' method to scale the character to prepare for speech"
	), charList);
	addMethodToList(new Method('setDefaultAnimationInterpolation', ['setDefGraph', 'setDefEase'], null, [swing], lexer, cc,
		"The default animation interpolation graph (easing) the character uses for all its animation if the animation did not specify."
	), charList);
	addMethodToList(new Method('addSprite', [], null, [spriteName, spritePath], lex, cc,
		"Adds a sprite to the character. The name of the sprite would be refered to when changing Sprites"
	), charList);
	addMethodToList(new Method('setFontSize', ['setTextSize'], null, [fontSize], lexer, cc,
		"Sets font size of the character. The units can be in em, %, px, vh or vw. The recommended unit to use is vw"
	), charList);
	addMethodToList(new Method('setBold', [], null, [], lex, cc,
		"Makes the character's text bold"
	), charList);
	addMethodToList(new Method('setItalic', [], null, [], lex, cc,
		"Makes the character's text italics"
	), charList);
	addMethodToList(new Method('editBold', [], null, [bold], lexer, cc,
		"Change's the character bold status."
	), charList);
	addMethodToList(new Method('editIatlic', [], null, [italic], lexer, cc,
		"Change's the character italic status."
	), charList);
	addMethodToList(new Method('setTextColor', ['setFontColor'], null, [color], lexer, cc,
		"Changes the character's text color when he/she/it speaks"
	), charList);
	addMethodToList(new Method('setOpacity', ['setAlpha'], null, [opacity], lexer, cc,
		"Changes the opacity of the character."
	), charList);
	addMethodToList(new Method('setAnchorX', ['setAX'], null, [anchorX], lexer, cc,
		"Changes the horizontal (or X) anchor of the character. Do note that the character will move when animated to adjust to its new anchor"), charList);
	addMethodToList(new Method('setAnchorY', ['setAY'], null, [anchorY], lexer, cc,
		"Changes the vertical (or Y) anchor of the charcater. Do note that the character will move when aniamted to adjust to its new anchor"
	), charList);
	addMethodToList(new Method('setHorizontalAlign', ['setXAlign', 'setHAlign'], null, [hAlign], lexer, cc,
		"Sets the horizontal (or X) alignment of the character. Do note that the character will move when animated to adjust to its new alignment"
	), charList);
	addMethodToList(new Method('setVerticalAlign', ['setYAlign', 'setVAlign'], null, [vAlign], lexer, cc,
		"Sets the vertical (or Y) alignment of the character. Do note that the character will move when animated to adjust to its new alignment"
	), charList);
	addMethodToList(new Method('setXOffSet', ['setX'], null, [xArg], lexer, cc,
		"Sets the charcater's horizontal offset from the origin of the screen that the character is aligned to."
	), charList);
	addMethodToList(new Method('setYOffSet', ['setY'], null, [yArg], lexer, cc,
		"Sets the character's vertical offset from the origin of the screen that the characted is aligned to."
	), charList);
	addMethodToList(new Method('setHorizontalFlip', ['setHFlip', 'setXFlip'], null, [hflip], lexer, cc,
		"Sets the character's horizontal flip status."
	), charList);
	addMethodToList(new Method('setVerticalFlip', ['setVFlip', 'setYFlip'], null, [vflip], lexer, cc,
		"Sets the character's vertical flip status"
	), charList);
	addMethodToList(new Method('setWidth', [], null, [width], lexer, cc,
		'Sets the character\'s width. This is relative to the VN Screen Width*'
	), charList);
	addMethodToList(new Method('setHeight', [], null, [height], lexer, cc,
		'Sets the character\'s height. This is relative to the VN Screen width** '
	), charList);
	addMethodToList(new Method('setInvert', [], null, [invert], lexer, cc,
		'Set how invert the colors of the character is'
	), charList);
	addMethodToList(new Method('setSepia', [], null, [sepia], lexer, cc,
		'Set how sepia the colors of the character is'
	), charList);
	addMethodToList(new Method('setBlur', [], null, [blur], lexer, cc,
		'Set how blur the character is'
	), charList);
	addMethodToList(new Method('setGrayscale', [], null, [grayscale], lexer, cc,
		'Set how close to black and white the character colors are. Grayscaling.'
	), charList);
	addMethodToList(new Method('setContrast', [], null, [contrast], lexer, cc,
		'Adjust the contrast of the charcater'
	), charList);
	addMethodToList(new Method('setStarutaion', ['setSaturate'], null, [saturate], lexer, cc,
		'Adjust the color saturation of the character'
	), charList);
	addMethodToList(new Method('setBrightness', [], null, [bright], lexer, cc,
		'Adjust the brightness of the character (color)'
	), charList);
	addMethodToList(new Method('setHueRotation', [], null, [huerotation], lexer, cc,
		'Adjust the hue of the character by rotating them by a set angle'
	), charList);
	addMethodToList(new Method('setRotation', [], null, [angle], lexer, cc,
		'Adjust the rotation of the character, clockwise.'
	), charList);
	addMethodToList(new Method('setXSkew', [], null, [skewX], lexer, cc,
		'Adjust the horizontal skew applied to the character.'
	), charList);
	addMethodToList(new Method('setYSkew', [], null, [skewY], lexer, cc,
		'Adjust he vertical skew applied to the character.'
	), charList);
	//setters
	addMethodToList(new Method('setNormalText', ['resetText', 'resetFont'], null, [], lex, set,
		'Resets the font of the character back to default'
	), charList);
	addMethodToList(new Method('changeBold', [], null, [bold], lexer, set,
		'Change the chaaracter\'s bold status for its speaking text'
	), charList);
	addMethodToList(new Method('changeItalic', [], null, [italic], lexer, set,
		'Change the character\'s italic status for its speaking text'
	), charList);
	addMethodToList(new Method('resetValues', ['resetVal'], null, [], lex, set,
		'Resets the character value back to default'
	), charList);
	//pre animation
	addMethodToList(new Method('preScale', [], null, [scaleX, scaleY], lex, panim,
		'Scales the character but does not animate it, yet. Values will be applied on next animation.'
	), charList);
	addMethodToList(new Method('preMove', [], null, [moveX, moveY], lex, panim,
		'Moves the character but does not animate it yet. Values will be applied on next animation.'
	), charList);
	addMethodToList(new Method('preRotate', [], null, [angleCW], lexer, panim,
		'Rotate the charcater from the current position but does not animate it yet. Values will be applied on next animation.'
	), charList);
	addMethodToList(new Method('preSkew', [], null, [XSkew, YSkew], lex, panim,
		'Skew character from the current position but does not animate it yet. Values will be applied on next animation.'
	), charList);
	//instants
	addMethodToList(new Method('changeSprite', [], null, [spriteName, promise], lexer, inst,
		'Changes the sprite of the character'
	), charList);
	addMethodToList(new Method('bringToFront', [], null, [promise], lex, inst,
		'Instantly brings the character to the front (will not be covered by other character on the same spot) within its overlay layer. This means that if its under the overlay and character A is above overlay, bringing this character to the front would not bring it infront of character A. '
	), charList);
	addMethodToList(new Method('sendToBack', [], null, [promise], lex, inst,
		'Instantly brings the character to the back (will be covered by all other character on the same spot) within its overlay layer. This means that if its over the overlay and character A is under overlay, bringing this character to the back would not bring it behind of character A. '
	), charList);
	addMethodToList(new Method('bringAboveOverlay', [], null, [promise], lex, inst,
		'Instantly brings the character to above the overlay layer. Characters will preserve their relative front-back position to other characters within the same overlay layer, but a character above the overlay will always be infront of a character behind the overlay. '
	), charList);
	addMethodToList(new Method('bringBelowOverlay', [], null, [promise], lex, inst,
		'Instantly brings the character to below the overlay layer. Characters will preserve their relative front-back position to other characters within the same overlay layer, but a character above the overlay will always be infront of a character behind the overlay. '
	), charList);
	//animations
	addMethodToList(new Method('speak', ['say'], null, [text, promise, texttime, skip], lex, anim,
		'Make the character open the text box and say stuff. It will use the character\'s current name as the name. Do note that this will clear whatever text there are in the current textbox (if it is completed displaying) and be ignored if the current textbox is still animating its text. '
	), charList);
	addMethodToList(new Method('contSpeaking', ['contSpeak', 'contSay', 'cont'], null, [text, promise, texttime, skip, newLine, appendSpace], lex, anim,
		'This method is exactly same as the speak method ,except it does not clear the textbox before display its own text. '
	), charList);
	addMethodToList(new Method('setDefaultFlip', ['setDefFlip'], null, [promise, time, swing, skip], lex, anim,
		'Animates the character back to its default flip status.'
	), charList);
	addMethodToList(new Method('flipVertically', [], null, [promise, time, swing, skip], lex, anim,
		'Flips/mirror the character vertically. (up-down). This is relative to its current flip status.'
	), charList);
	addMethodToList(new Method('flipHorizontally', [], null, [promise, time, swing, skip], lex, anim,
		'Flips/mirror the character vertically. (left-right). This is relative to its current flip status.'
	), charList);
	addMethodToList(new Method('scale', [], null, [scaleX, scaleY, time, promise, swing, skip], lex, anim,
		'Scales the character by the given factor. Note that this is relative to the character\'s current size.'
	), charList);
	addMethodToList(new Method('move', [], null, [moveX, moveY, time, promise, swing, skip], lex, anim,
		'Move the character relative to current position horizontally by x (in terms of percentage of VN\'s screen width), and vertically by y (in terms of percentage of VN\'s screen height). Positive x will move the character to the right, negative x will move the character to the left. Positive y will move the character downwards, negative y will move the character upwards. '
	), charList);
	addMethodToList(new Method('jump', [], null, [xArg, yArg, time, promise, swing, skip], lex, anim,
		"Move the character horizontally to x (in terms of percentage of VN's screen width) away from the origin, and vertically to y (in terms of percentage of VN's screen height) away from the origin. Positive x will move the character to the right of the origin, , negative x will move the character to the left of the origin. Positive y will move the character below the origin, negative y will move the character above the origin. "
	), charList);
	addMethodToList(new Method('disappear', [], null, [time, promise, swing, skip], lex, anim,
		'Fades the character out within the time limit. If time is 0, will instantly disappear. '
	), charList);
	addMethodToList(new Method('appear', [], null, [time, promise, swing, skip], lex, anim,
		'Fades the character in within the time limit. If time is 0, will instantly appear. '
	), charList);
	addMethodToList(new Method('moveAnchorX', [], null, [xArg, time, promise, swing, skip, adjust], lex, anim,
		"Changes the anchor X of the character. This will result in a movement in character, the movement will be done in the time given. If you do not want the movement cause by the anchor change, please put adjust to true, the engine will then change the anchor of the character while trying to correct it offset such that the character will not move. "
	), charList);
	addMethodToList(new Method('moveAnchorY', [], null, [yArg, time, promise, swing, skip, adjust], lex, anim,
		"Changes the anchor Y of the character. This will result in a movement in character, the movement will be done in the time given. If you do not want the movement cause by the anchor change, please put adjust to true, the engine will then change the anchor of the character while trying to correct it offset such that the character will not move. "
	), charList);
	addMethodToList(new Method('moveVerticalAlign', [], null, [yArg, time, promise, swing, skip, adjust], lex, anim,
		"Changes the vertical alignment or yAlign of the character. This will result in a movement in character, the movement will be done in the time given. If you do not want the movement cause by the alignment change, please put adjust to true, the engine will then change the alignment of the character while trying to correct it offset such that the character will not move. "
	), charList);
	addMethodToList(new Method('moveHorizontalAlign', [], null, [xArg, time, promise, swing, skip, adjust], lex, anim,
		"Changes the horizontal alignment or x Align of the character. This will result in a movement in character, the movement will be done in the time given. If you do not want the movement cause by the alignment change, please put adjust to true, the engine will then change the alignment of the character while trying to correct it offset such that the character will not move. "
	), charList);
	addMethodToList(new Method('blur', [], null, [blur, time, promise, swing, skip], lex, anim,
		"Blurs the charcater in the given time"
	), charList);
	addMethodToList(new Method('invert', [], null, [invert, time, promise, swing, skip], lex, anim,
		"Inverts or negate the color of the charcater in the given time"
	), charList);
	addMethodToList(new Method('grayscale', [], null, [grayscale, time, promise, swing, skip], lex, anim,
		"Grayscales the color of the character (make it close to black and white) in the given time"
	), charList);
	addMethodToList(new Method('sepia', [], null, [sepia, time, promise, swing, skip], lex, anim,
		"Sepia the color of the charcater in the given time"
	), charList);
	addMethodToList(new Method('contrast', [], null, [contrast, time, promise, swing, skip], lex, anim,
		"Adjust the contrast of the character in the given time"
	), charList);
	addMethodToList(new Method('saturate', [], null, [saturate, time, promise, swing, skip], lex, anim,
		"Saturate the color of the character in the given time"
	), charList);
	addMethodToList(new Method('brightness', [], null, [bright, time, promise, swing, skip], lex, anim,
		"Brighten or darken the character in the given time"
	), charList);
	addMethodToList(new Method('rotateHue', [], null, [huerotation, time, promise, swing, skip], lex, anim,
		"Rotate the hue of the character in the given time"
	), charList);
	addMethodToList(new Method('rotateClockwise', [], null, [angleCW, time, promise, swing, skip], lex, anim,
		"Rotate the character clockwise by the given degree in the given time"
	), charList);
	addMethodToList(new Method('rotateAntiClockwise', [], null, [angleACW, time, promise, swing, skip], lex, anim,
		"Rotate the character anti-clockwise by the given degree in the given time"
	), charList);
	addMethodToList(new Method('skew', [], null, [XSkew, YSkew, time, promise, swing, skip], lex, anim,
		"Skew the character in the given time"
	), charList);
	addMethodToList(new Method('wait', [], null, [time, promise, skip], lex, anim,
		"The character does nothing till the time is up, then the promise is fulfilled. "
	), charList);
	addMethodToList(new Method('animate', [], null, [time, promise, swing, skip], lex, anim,
		"The character will animate from its screen values to whatever values it has. This method is a one-size-fit-all method for animating. Use setters, pre-animations and chain constructors to change the value (they do not directly apply to the character on screen), and call this function to transform this character to whatever new values is! "
	), charList);
	addMethodToList(new Method('resetAll', [], null, [time, promise, swing, skip], lex, anim,
		"This will reset the character to its default state (all values), and animate it to that state. See character-defaults. "
	), charList);
	//frill
	addMethodToList(new Method('triggered', ['trigger'], null, [time, promise, skip, shake, delay], lex, fr,
		"Shakes the character, as if he/she/it is triggered. "
	), charList);
	addMethodToList(new Method('glitch', [], null, [spriteName], lex, fr,
		"Glitches the character constantly, the character will constantly glitch until .fix() is called. You may make the glitchs have a different sprite, if not stated, the sprite will always change with the character sprite, else, the glitch will always have the specified sprite. "
	), charList);
	addMethodToList(new Method('endSpeak', [], null, [promise, spsTime, swing, skip], lex, fr,
		"Reverts the character back to normal size after preSpeak is used."
	), charList);
	addMethodToList(new Method('preSpeak', [], null, [promise, scaleV, spsTime, swing, skip], lex, fr,
		"Scales the character and brings the character to front. Commonly used before speaking"
	), charList);
	addMethodToList(new Method('interupt', ['interrupt'], null, [promise, scaleV, spsTime, swing, skip], lex, fr,
		"Prespeaks and interrupt the previous character while talking"
	), charList);
	addMethodToList(new Method('fix', [], null, [], lex, fr,
		"Fixes the character if its glitching"
	), charList);
	addMethodToList(new Method('cycle', [], null, [promise], lex, o,
		"Starts a cycle. This allows you to make animations that ignores frame-design, and cycles till the stop cycle is called."
	), charList);
	addMethodToList(new Method('endOfCycle', [], null, [], lex, o,
		"Marks the end of a cycle sequence and to start from the start."
	), charList);
	addMethodToList(new Method('stopCycle', [], null, [time, promise, swing, skip], lex, o,
		"Stops the character if its in a cycle sequence"
	), charList);
	//multithread
	addMethodToList(new Method('waitFor', [], null, [gameInstance, promise], lexer, o,
		"Make this thread wait until another thread notifies this thread."
	), charList);
	addMethodToList(new Method('notifyWaiter', ['notify'], null, [gameInstance], lexer, o,
		"Notify the a thread that may be waiting for this thread."
	), charList);
	return charList;
}

function initBackground(bgList) {
	var lex = new Lexer();
	var lexer = new Lexer2();
	//animation
	var prior = 'Reset this value to prior to .complete() call for the background. See background-defaults';
	var gg = "Globals";
	var cc = "Chain Constructor";
	var set = "Setter";
	var anim = "Animation";
	var panim = "Pre Animations";
	var inst = "Instants";
	var fr = "Frills";
	var o = "Others";
	//arguments
	var dir = new Args('directory', ['dir'], 'string', 'URL',
		'Directory which contains the background for this stage. Can be online URL.', {
			'string': 'directory to point to',
			'def/null/undefined': 'bkgd folder in images in kvn folder'
		});
	var dskip = new Args('skip', [], 'boolean', 'boolean',
		'By default, whether the background\'s animations can be skipped (if the skip argument is not supplied)', {
			'true': 'Backgrounds\'s animation can be skipped unless specified at animation level. This does not affect for "wait" method',
			'false': 'Backgrounds\'s animations cannot be skipped unless the specified at animation level.',
			'null/undefined': prior,
			'def': 'Makes the background animation skip-able unless specified at animation level'
		});
	var spriteName = new Args('spriteName', ['name', 'bg', 'background'], 'string', 'string',
		'The name of the sprite.', {
			'string': 'Any string. Preferable without spaces or special character. Eg: sad, smile_speak'
		});
	var spritePath = new Args('backgroundPath', ['path'], 'string', 'URL',
		'The path to the background (image). Do include file extension. The default image folder is "images/bkgd". background links can include relative resource locations. ', {
			'string': 'Any legit URL that points to an image within the folder (or preset directory). Eg: chinatown.png, temple/raining.png'
		});
	var textnull = 'It will use the value used in the previous time the method is called for this specific stage with the specific "centered" setting. If the stage has never called this method, it will automatically use "def" as input';
	var name = new Args('name', [], 'string', 'string',
		'Name of to be displayed as speaking', {
			'string': 'Any string to be displayed as name. Eg: John Smith, Kami-sama',
			'none': 'Will not display the name box',
			'def': 'Will not display the name box',
			'null/undefined': textnull
		}
	);
	var texttime = new Args('time', ['t'], 'number', '+int',
		'Time taken for the text to be displayed in milliseconds. If this number is too low, it will revert to 10ms between each character.', {
			'number': 'Any non-zero positive integer. This is the number of milliseconds.',
			'def': '1000',
			'null/undefined': 'each character will appear every 20 milliseconds (normal scrolling speed)'
		}
	);
	var centered = new Args('centered', ['center'], 'boolean', 'boolean',
		'Whether the text is centered or top left', {
			'true': 'Text will be center of text box',
			'false': 'Text will be top left of the text box',
			'def': 'Text will be top left of the text box',
			'null/undefined': textnull
		}
	);
	var fontSize = new Args('fontSize', ['textSize', 'fs', 'size'], 'string', 'font-size',
		'The font size when the used when the stage displays text.', {
			'html units': 'Any number with a html unit. Eg: 1.5vw, 20px, 5vh, 7%, 8.33em.',
			'null/undefined': textnull,
			'def': '1.5vw'
		});
	var bold = new Args('bold', [], 'boolean', 'boolean',
		'Whether the background\'s text will be bold.', {
			'true': 'Background text will be bold',
			'false': 'Background text will not be bold',
			'null/undefined': textnull,
			'def': 'false'
		});
	var italic = new Args('italic', [], 'boolean', 'boolean',
		'Whether the background\'s text will be italic.', {
			'true': 'Background text will be italic',
			'false': 'Background text will not be italic',
			'null/undefined': textnull,
			'def': 'false'
		});
	var color = new Args('color', ['colour', 'yanse'], 'string', 'color',
		'Background\'s text/font color. ', {
			"6-hex": "6 Digit hexidecimal Color code. Example: #00FF00",
			"3-hex": "3 Digit hexidecimal Color code. Example: #FA3",
			"RGBA": "RedGreenBlueAlpha values between 0-255. Eg: rgba(0,0,254,0.5)",
			"HTML presets": "List of HTML preset colors. Eg: black, green, blue, red, yellow, aqua",
			"null/undefined": textnull,
			"def": "black"
		});
	var colour = new Args('color', ['colour', 'yanse'], 'string', 'color',
		'Color of this layer. ', {
			"6-hex": "6 Digit hexidecimal Color code. Example: #00FF00",
			"3-hex": "3 Digit hexidecimal Color code. Example: #FA3",
			"RGBA": "RedGreenBlueAlpha values between 0-255. Eg: rgba(0,0,254,0.5)",
			"HTML presets": "List of HTML preset colors. Eg: black, green, blue, red, yellow, aqua",
			"null/undefined": textnull,
			"def": "black"
		});
	var opacity = new Args('opacity', ['o', 'a', 'alpha'], 'number', 'float',
		'Opacity of this layer.', {
			'float': 'decimals between 0 and 1 inclusive, where 0 is completely transparent and 1 is completely opaque. Eg: 0.5, 0.66, 1',
			'null/undefined': prior,
			'def': '0'
		});
	var bdopacity = new Args('opacity', ['o', 'a', 'alpha'], 'number', 'float',
		'Opacity of this layer.', {
			'float': 'decimals between 0 and 1 inclusive, where 0 is completely transparent and 1 is completely opaque. Eg: 0.5, 0.66, 1',
			'null/undefined': prior,
			'def': '1'
		});
	var anchorX = new Args('anchorX', ['x', 'aX', 'xOrigin', 'originX'], 'number', 'number',
		'The X or Horizontal Anchor of the Background. See alignment and anchoring.', {
			'number': 'Any number between 0 and 100, where 0 will be the extreme left and 100 will be the extreme right. 50 would be the horizontal center of the Background.',
			'null/undefined': prior,
			'def': '0'
		});
	var anchorY = new Args('anchorY', ['y', 'aY', 'yOrigin', 'originY'], 'number', 'number',
		'The Y or Vertical Anchor of the Background. See alignment and anchoring.', {
			'number': 'Any number between 0 and 100, where 0 will be the extreme top and 100 will be the extreme bottom. 50 would be the vertical center of the Background.',
			'null/undefined': prior,
			'def': '0'
		});
	var xArg = new Args('x', ['xPos', 'left', 'xOffset'], 'number', 'number',
		'The horizontal (or x) offset of the background.', {
			'number': 'Any real number. It is in percentage of VN Engine\'s screen width. Ie 5 is 5% of the VN Engine Screen width to the right, whereas -8.55 is -8.55% of the VN Engine Screen width to the left. ',
			'null/undefined': prior,
			'def': 0
		});
	var yArg = new Args('y', ['yPos', 'top', 'yOffset'], 'number', 'number',
		'The vertical (or y) offset of the Background.', {
			'number': 'Any real number. It is in percentage of VN Engine\'s screen height. Ie 5 is 5% of the VN Engine Screen height downwards, whereas -8.55 is -8.55% of the VN Engine Screen height upwards. ',
			'null/undefined': prior,
			'def': 0
		});
	var hflip = new Args('hflip', ['horizontalFlip'], 'boolean', 'boolean',
		'Whether the background is flipped horizontally (along the y axis, on the x axis)', {
			'true': 'The background is flipped horizontally',
			'false': 'The Background is not flipped horizontally',
			'null/undefined': prior,
			'def': 'The Background is not flipped horizontally'
		});
	var vflip = new Args('vflip', ['verticalFlip'], 'boolean', 'boolean',
		'Whether the Background is flipped vertically (along the x axis, on the y axis)', {
			'true': 'The Background is flipped vertically',
			'false': 'The Background is not flipped vertically',
			'null/undefined': prior,
			'def': 'The Background is not flipped vertically'
		});
	var width = new Args('width', ['w'], 'number', '!0+number',
		'The width the Background. This is in percentage of the screen width*.', {
			'number': 'Non-negative, non-zero number. Eg: 5, 75.5',
			'null/undefined/def': prior
		});
	var height = new Args('height', ['h'], 'number', '!0+number',
		'The height the Background. This is in percentage of the screen height*.', {
			'number': 'Non-negative, non-zero number. Eg: 5, 75.5',
			'null/undefined/def': prior
		});
	var sepia = new Args('sepia', ['filter', 'f'], 'number', 'float',
		'How sepia the background is, where 0 is no sepia filter and 1 is maximum sepia filter', {
			'number': 'Any floating point between 0 and 1. Eg: 0.5, 0, 0.224',
			'null/undefined': prior,
			'def': '0'
		});
	var invert = new Args('invert', ['filter', 'f', 'negative'], 'number', 'float',
		'How negative the Background color is, where 0 is no negative filter and 1 iis when the Background is compeletely inverted. At 0.5, the Background will be completely grey.', {
			'number': 'Any floating point between 0 and 1. Eg: 0.5, 0, 0.224',
			'null/undefined': prior,
			'def': '0'
		});
	var blur = new Args('blur', ['filter', 'f'], 'number', 'float',
		'How blur the Background is, where at 0 the Background is clear and 1 is very blur. You can exceed the value 1 but its is not recommended', {
			'number': 'Any floating point between 0 and 1. Eg: 0.5, 0, 0.224',
			'null/undefined': prior,
			'def': '0'
		});
	var contrast = new Args('contrast', ['filter', 'f'], 'number', 'float',
		'How much contrast to apply to the Background is, where 1 is normal, values between 0-1 will decrease contrast while values above 1 will increase the contrast', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 3.6',
			'null/undefined': prior,
			'def': '1'
		});
	var saturate = new Args('saturation', ['filter', 'f', 'saturate'], 'number', 'float',
		'How saturated the Background is, where 1 is no saturation. Sub 1 is undersaturation and values above one will increase the saturation.', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 3.6',
			'null/undefined': prior,
			'def': '1'
		});
	var grayscale = new Args('grayscale', ['filter', 'gray'], 'number', 'float',
		'How close to black and white (grayscale) the Background is. 1 is fully gray-scaled.', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 1',
			'null/undefined': prior,
			'def': '0'
		});
	var bright = new Args('brightness', ['filter', 'f', 'bright'], 'number', 'float',
		'How bright the Background is, where 1 is the normal brightness. Sub 1 is darken the Background and values above one will increase the Background brightness.', {
			'number': 'Any floating point above 0. Eg: 0.5, 0, 0.224, 3.6',
			'null/undefined': prior,
			'def': '1'
		});
	var huerotation = new Args('angle', ['filter', 'f', 'rotate', 'rotation'], 'number', 'degree',
		'Hue rotation of the Background is.', {
			'degree': 'Any degree between 0-360. Larger or smaller values will loop back.',
			'null/undefined': prior,
			'def': '0'
		});
	var angle = new Args('angle', ['degree', 'rotate', 'rotation'], 'number', 'degree',
		'Rotation of the Background clockwise in degrees', {
			'degree': 'Any number between 0-360. Larger or smaller values will loop back.',
			'null/undefined': prior,
			'def': '0'
		});
	var skewX = new Args('xSkew', ['x', 'angleX', 'skewX'], 'number', 'degree',
		'How many degrees the Background is skewed horizontally', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'null/undefined': prior,
			'def': '0'
		});
	var skewY = new Args('ySkew', ['y', 'angleY', 'skewY'], 'number', 'degree',
		'How many degrees the Background is skewed vertically', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'null/undefined': prior,
			'def': '0'
		});
	var scaleX = new Args('scaleX', ['x', 'xScale', 'w', 'width'], 'number', '+number',
		'The factor to scale horizontally (width) by.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'null/undefined': 'Original width of Background',
			'def': '1.2'
		});
	var scaleY = new Args('scaleY', ['y', 'yScale', 'height', 'h'], 'number', '+number',
		'The factor to scale vertically (height) by.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'null/undefined': 'Original height of Background',
			'def': '1.2'
		});
	var moveX = new Args('x', ['left', 'xPos'], 'number', 'number',
		'The amount to shift the Background horizontally by. This is in percentage of the VN screen width. Positive is to the right where as negative is to the left.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'def': '0',
			'null/undefined': 'Original x position of the Background'
		});
	var moveY = new Args('y', ['top', 'yPos'], 'number', 'number',
		'The amount to move the Background vertically by. This is in percentage of the VN screen height. Positive is downwards where as negative is upwards.', {
			'number': 'Any positive number. Eg: 1.5, 0.2,1.05 ,3',
			'def': '0',
			'null/undefined': 'Original y position of the Background'
		});
	var angleCW = new Args('angle', ['degree', 'rotate', 'rotation'], '+number', 'degree',
		'Rotation of the Background clockwise in degrees. Only positive numbers', {
			'degree': 'Any number between 0-360. Larger values will loop back.',
			'def/null/undefined': 'Rotates the Background back to normal.'
		});
	var angleACW = new Args('angle', ['degree', 'rotate', 'rotation'], '+number', 'degree',
		'Rotation of the Background anti-clockwise in degrees. Only positive numbers', {
			'degree': 'Any number between 0-360. Larger values will loop back.',
			'def/null/undefined': 'Rotates the Background back to normal.'
		});
	var XSkew = new Args('xSkew', ['x', 'angleX', 'skewX'], 'number', 'degree',
		'How many degrees the Background is skewed horizontally', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'def/null/undefined': 'Unskews the Background back to normal.'
		});
	var YSkew = new Args('ySkew', ['y', 'angleY', 'skewY'], 'number', 'degree',
		'How many degrees the Background is skewed vertically', {
			'degree': 'Any number between 0-180. Larger numbers will flip the image and smaller numbers will skew in the opposite direction.',
			'def/null/undefined': 'Unskews the Background back to normal.'
		});
	var text = new Args('text', ['msg'], 'string', 'string',
		'The text to display on the textbox.', {
			'string': 'Any valid string. Do note that if it is too long it will clip out of the text box'
		});
	//common animations
	var promise = new Args('promise', [], 'function', 'promise',
		'A promise to be fulfilled. This is a function, when this animation or instant ends (whether skipped or not), the promise will be executed.', {
			'function': 'a full defined javacsript function. This can be other animations, setters or anything at all.',
			'null/undefined': 'Ends the animation thread. When all animation thread ends in aframe, the frame will be considered to have ended.'
		});
	var time = new Args('time', ['t'], 'number', '+int',
		'How much time to complete the animation or instant in milliseconds. 0 will make it animate to it end-state instantly ', {
			'number': 'Positive integers in milliseconds.',
			'null/undefined': '0',
			'def': '1000'
		});
	var swing = new Args('graph', ['g'], 'object', 'animation-graph',
		'The animation interpolation type', {
			'linear': 'normal',
			'swing': 'slow-fast-slow',
			'easeIn': 'slow->fast',
			'easeOut': 'fast->slow',
			'easeBack': 'fast till exceed -> slowly go back to correct position',
			'elastic': 'rubberband effect',
			'bounce': 'like ball bouncing',
			'slowMotion': 'slow motion effect',
			'stepped': 'Not continous, jagged. Stepped function',
			'rough': 'random sharp jumps',
			'null/undefined': 'The stage default animation-interpolation policy. To change check the method setDefaultAnimationInterpolation',
			'def': 'swing'
		});
	var skip = new Args('skip', ['s'], 'boolean', 'boolean',
		'Whether this animation can be skipped by clicking', {
			'true': 'This animation can be skipped by clicking',
			'false': 'This animation cannot be skipped by clicking',
			'null/undefined': 'The stage default policy regarding animation skip-ablity. To change check the method setDefaultSkippable.'
		});
	var shake = new Args('shake', [], 'number', '+number',
		'The percentage of the background/stage to shake by. 1 would be 1% of the background\'s width and height, and 0.5 would be 0.5% of the background\'s width and height. ', {
			'number': 'Any non-zero positive float or integer',
			'null/def/undefined': 'shake the background by 0.5%'
		});
	var delay = new Args('delay', [], 'number', '!0+int',
		'Shaking can be seen as a frame of shifting the background. The delay is the time between each change in position. Default value is 25 (undefined/null/def).', {
			'number': 'time in milliseconds. Only non-zero positive integers',
			'null/def/undefined': '25'
		});
	var gameInstance = new Args('gameInstant', ['char', 'bg', 'character', 'background', 'instance'], 'object', 'game-instance',
		'Stage or Character', {
			'stage': 'Fully constructed Stage Object',
			'character': 'Fully constructed Character Object'
		}
	);
	var options = new Args('options', ['option', 'optionArr', 'optionArray'], 'object', 'array',
		'Array of option object', {
			'Array': 'Array of fully constructed Options Object'
		}
	);
	var optionX = new Args('x', [], 'number', 'number',
		'The x position of the option in percentage of the VN screen Width', {
			'number': 'Any valid number',
			'null/undefined/def': '0'
		}
	);
	var optionY = new Args('y', [], 'number', 'number',
		'The y position of the option in percentage of the VN screen Height', {
			'number': 'Any valid number',
			'null/undefined/def': '0'
		}
	);
	var optionW = new Args('width', ['w'], 'number', '!0+number',
		'The width of the option in percentage of the VN screen width', {
			'number': 'Any non-zero positive number',
			'null/undefined/def': '20'
		}
	);
	var optionH = new Args('height', ['h'], 'number', '!0+number',
		'The height of the option in percentage of the VN screen height', {
			'number': 'Any non-zero positive number',
			'null/undefined/def': '20'
		}
	);
	var optionFS = new Args('fontSize', ['textSize', 'size'], 'number', '!0+number',
		'The font size of the text in the option box. This only allows non-zero positive number as input', {
			'number': 'Non zero positive number as input. Eg: 2, 1.5, 0.6,5.55',
			'null/def/undefined': '2.5'
		});
	var optionPad = new Args('padding', ['pad'], 'number', '+number',
		'The padding of the option box. ', {
			'number': 'Positive number as input. Eg: 2, 1.5, 0.6,5.55',
			'null/def/undefined': '1'
		});
	var optionMargin = new Args('margin', ['mar'], 'number', '+number',
		'The margin of the option box. ', {
			'number': 'Positive number as input. Eg: 2, 1.5, 0.6,5.55',
			'null/def/undefined': '1'
		});
	var optionColumns = new Args('column', ['col'], 'number', '!0+int',
		'Number of columns to display the options in', {
			'number': 'Positive interger only. Eg: 1, 3, 6',
			'null/def/undefined': '1'
		});
	var bgA = new Args('bkgdAlpha', ['backgroundAlpha', 'backgroundOpacity', 'bgA', 'bgO', 'bkgdA', 'bkgdO', 'bkgdOpacity'], 'number', 'float',
		'Background Opacity to fade to. ', {
			'float': 'decimals between 0 and 1 inclusive, where 0 is completely transparent and 1 is completely opaque. Eg: 0.5, 0.66, 1',
			'def/null/undefined': '1'
		});
	var bdA = new Args('bkdpAlpha', ['backdropAlpha', 'backdropOpacity', 'bdA', 'bdO', 'bkdpA', 'bkdpO', 'bkdpOpacity'], 'number', 'float',
		'Background Opacity to fade to. ', {
			'float': 'decimals between 0 and 1 inclusive, where 0 is completely transparent and 1 is completely opaque. Eg: 0.5, 0.66, 1',
			'def/null/undefined': '1'
		});
	var offBackdrop = new Args('offBackdrop', ['off'], 'boolean', 'boolean',
		'Whether to fadeout the backdrop when undisplaying stage', {
			'true': 'Fadeout backdrop',
			'false': 'Don\'t fadeout backdrop',
			'def/null/undefined': 'Don\'t fadeout backdrop'
		});
	var char = new Args('character', ['char', 'c'], 'object', 'character',
		'Characters game objects', {
			'character': 'Fully constructed Character objects'
		});
	//setters
	addMethodToList(new Method('resetValues', [], null, [], lex, set,
		'Animate the background to the state prior to .complete() call.'
	), bgList);
	//CCs
	addMethodToList(new Method('setCustomDirectory', ['setDir'], null, [dir], lexer, cc,
		"Changes the default background image directory to a custom one. (Primary for CDN and URL uses)."
	), bgList);
	addMethodToList(new Method('setDefaultSkippable', ['setDefSkip'], null, [dskip], lexer, cc,
		"Boolean value. Changes whether stage animation can be skipped by default (when animation does not specify the animation skip-ability)."
	), bgList);
	addMethodToList(new Method('setDefaultAnimateInterpolation', ['setDefGraph'], null, [swing], lexer, cc,
		"The default animation interpolation graph (easing) the stage uses for all its animation if the animation did not specify."
	), bgList);
	addMethodToList(new Method('addBackground', ['addBG', 'addBkgd', 'addBg'], null, [spriteName, spritePath], lex, cc,
		"Adds a background to the stage. The background will be refered to via the name when changing backgrounds."
	), bgList);
	addMethodToList(new Method('setOpacity', [], null, [opacity], lexer, cc,
		"Sets the opacity of the background"
	), bgList);
	addMethodToList(new Method('setCoverOpacity', [], null, [opacity], lexer, cc,
		"Sets the opacity of the cover layer"
	), bgList);
	addMethodToList(new Method('setBackdropOpacity', [], null, [opacity], lexer, cc,
		"Sets the opacity of the backdrop layer"
	), bgList);
	addMethodToList(new Method('setOverlayOpacity', [], null, [opacity], lexer, cc,
		"Sets the opacity of the overlay layer"
	), bgList);
	addMethodToList(new Method('setCoverColor', [], null, [colour], lexer, cc,
		"Sets the color of the cover layer"
	), bgList);
	addMethodToList(new Method('setBackdropColor', [], null, [colour], lexer, cc,
		"Sets the color of the backdrop layer"
	), bgList);
	addMethodToList(new Method('setOverlayColor', [], null, [colour], lexer, cc,
		"Sets the color of the overlay layer"
	), bgList);
	addMethodToList(new Method('setInvert', [], null, [invert], lexer, cc,
		"Sets how negative or inverted the color of the background is"
	), bgList);
	addMethodToList(new Method('setBlur', [], null, [blur], lexer, cc,
		"Sets the blurness of the background"
	), bgList);
	addMethodToList(new Method('setGrayscale', [], null, [grayscale], lexer, cc,
		"Adjust the color of background closeness to grayscale (black/white)"
	), bgList);
	addMethodToList(new Method('setSepia', [], null, [sepia], lexer, cc,
		"Adjust the sepia filter on the background"
	), bgList);
	addMethodToList(new Method('setContrast', [], null, [contrast], lexer, cc,
		"Adjust the contrast of the background"
	), bgList);
	addMethodToList(new Method('setSaturation', [], null, [saturate], lexer, cc,
		"Adjust the color saturation of the background"
	), bgList);
	addMethodToList(new Method('setBrightness', [], null, [bright], lexer, cc,
		"Sets the brightness of the background"
	), bgList);
	addMethodToList(new Method('setHueRotation', [], null, [huerotation], lexer, cc,
		"Adjust the hue of background by rotate it "
	), bgList);
	addMethodToList(new Method('setRotation', [], null, [angle], lexer, cc,
		"Adjust the rotation of the background"
	), bgList);
	addMethodToList(new Method('setXSkew', [], null, [skewX], lexer, cc,
		'Adjust the horizontal skew applied to the background.'
	), bgList);
	addMethodToList(new Method('setYSkew', [], null, [skewY], lexer, cc,
		'Adjust he vertical skew applied to the background.'
	), bgList);
	addMethodToList(new Method('setXOffSet', ['setX'], null, [xArg], lexer, cc,
		"Sets the background's horizontal offset"
	), bgList);
	addMethodToList(new Method('setYOffSet', ['setY'], null, [yArg], lexer, cc,
		"Sets the background's vertical offset."
	), bgList);
	addMethodToList(new Method('setHorizontalFlip', ['setHFlip', 'setXFlip'], null, [hflip], lexer, cc,
		"Sets the background's horizontal flip status."
	), bgList);
	addMethodToList(new Method('setVerticalFlip', ['setVFlip', 'setYFlip'], null, [vflip], lexer, cc,
		"Sets the background's vertical flip status"
	), bgList);
	addMethodToList(new Method('setWidth', [], null, [width], lexer, cc,
		'Sets the background\'s width. This is relative to the VN Screen Width*'
	), bgList);
	addMethodToList(new Method('setHeight', [], null, [height], lexer, cc,
		'Sets the background\'s height. This is relative to the VN Screen Height* '
	), bgList);
	addMethodToList(new Method('setAnchorX', ['setAX'], null, [anchorX], lexer, cc,
		"Changes the horizontal (or X) anchor of the background."), bgList);
	addMethodToList(new Method('setAnchorY', ['setAY'], null, [anchorY], lexer, cc,
		"Changes the vertical (or Y) anchor of the background."
	), bgList);
	addMethodToList(
		new Method('complete', [], 'complete', [], lex, "Chain Constructor", "Marks the completion of the stage during construction. All values set by chain constructors, setters or pre-anim prior to this method call will be set as the stage's default values. When calling settings and animations, if the parameter is undefined or null, it will assume to animate to/set to these default values"), bgList);
	//pre animation
	addMethodToList(new Method('preScale', [], null, [scaleX, scaleY], lex, panim,
		'Scales the background but does not animate it, yet. Values will be applied on next animation.'
	), bgList);
	addMethodToList(new Method('preMove', [], null, [moveX, moveY], lex, panim,
		'Moves the background but does not animate it yet. Values will be applied on next animation.'
	), bgList);
	addMethodToList(new Method('preRotate', [], null, [angleCW], lexer, panim,
		'Rotate the background from the current position but does not animate it yet. Values will be applied on next animation.'
	), bgList);
	addMethodToList(new Method('preSkew', [], null, [XSkew, YSkew], lex, panim,
		'Skew background from the current position but does not animate it yet. Values will be applied on next animation.'
	), bgList);
	//animations
	addMethodToList(new Method('fadeInBackground', ['fadeIn', 'appear'], null, [time, promise, swing, skip], lex, anim,
		'Fades in the background in the given time. (Change background layer opacity to 1)'
	), bgList);
	addMethodToList(new Method('fadeOutBackground', ['fadeOut', 'disappear'], null, [time, promise, swing, skip], lex, anim,
		'Fades out the background in the given time. (Change background layer opacity to 0)'
	), bgList);
	addMethodToList(new Method('displayText', [], null, [text, texttime, promise, name, centered, fontSize, color, bold, italic, skip], lex, anim,
		'Displays a text on the text box. It can has various customizable settings for the text and their position. Do note that this will clear whatever text there are in the current textbox (if it is completed displaying) and be ignored if the current textbox is still animating its text. '
	), bgList);
	addMethodToList(new Method('fadeInText', [], null, [text, time, promise, name, centered, fontSize, color, bold, italic, skip], lex, anim,
		"Fades in the text instead of type writing it Do note that this will clear whatever text there are in the current textbox (if it is completed displaying) and be ignored if the current textbox is still animating its text. "
	), bgList);
	addMethodToList(new Method('wait', [], null, [time, promise, skip], lex, anim,
		"The stage does nothing till the time is up, then the promise is fulfilled. "
	), bgList);
	addMethodToList(new Method('changeCover', [], null, [opacity, colour, time, promise, swing, skip], lex, anim,
		"Change the cover's opacity and color to the parameter inputs in the time given"
	), bgList);
	addMethodToList(new Method('changeBackdrop', [], null, [bdopacity, colour, time, promise, swing, skip], lex, anim,
		"Change the backdrop's opacity and color to the parameter inputs in the time given"
	), bgList);
	addMethodToList(new Method('changeOverlay', [], null, [opacity, colour, time, promise, swing, skip], lex, anim,
		"Change the overlay's opacity and color to the parameter inputs in the time given"
	), bgList);
	addMethodToList(new Method('changeBackground', [], null, [spriteName, bdopacity, time, promise, swing, skip], lex, anim,
		"Fades the current background out and fades in the new background to the specified opacity in the given time"
	), bgList);
	addMethodToList(new Method('backgroundBlur', ['blurBackground', 'blur'], null, [blur, time, promise, swing, skip], lex, anim,
		"Blurs the background to the set value in the time given."
	), bgList);
	addMethodToList(new Method('backgroundInvert', ['invertBackground', 'invert'], null, [invert, time, promise, swing, skip], lex, anim,
		"Inverts the color of background to the set value in the time given. "
	), bgList);
	addMethodToList(new Method('backgroundGrayscale', ['grayscaleBackground', 'grayscale'], null, [grayscale, time, promise, swing, skip], lex, anim,
		"Adjust the color of the background to grayscale in the time given"
	), bgList);
	addMethodToList(new Method('backgroundSepia', ['sepiaBackground', 'sepia'], null, [sepia, time, promise, swing, skip], lex, anim,
		"Adjust the color of the background to sepia in the time given"
	), bgList);
	addMethodToList(new Method('backgroundContrast', ['contrastBackground', 'contrast'], null, [contrast, time, promise, swing, skip], lex, anim,
		"Adjust the contrast of the background in the time given"
	), bgList);
	addMethodToList(new Method('backgroundSaturate', ['saturateBackground', 'saturate'], null, [saturate, time, promise, swing, skip], lex, anim,
		"Adjust the color saturation of the background in the time given"
	), bgList);
	addMethodToList(new Method('backgroundBrightness', ['brightnessBackground', 'brightness'], null, [bright, time, promise, swing, skip], lex, anim,
		"Adjust the brightness of the background in the time given"
	), bgList);
	addMethodToList(new Method('backgroundRotateHue', ['rotateHueBackground', 'rotateHue'], null, [huerotation, time, promise, swing, skip], lex, anim,
		"Adjust hue of the background by rotating it in the given time"
	), bgList);
	addMethodToList(new Method('rotateBackgroundClockwise', ['rotateClockwise'], null, [angleCW, time, promise, swing, skip], lex, anim,
		"Rotate the background clockwise by the given degree in the given time"
	), bgList);
	addMethodToList(new Method('rotateBackgroundAntiClockwise', ['rotateAntiClockwise'], null, [angleACW, time, promise, swing, skip], lex, anim,
		"Rotate the background anti-clockwise by the given degree in the given time"
	), bgList);
	addMethodToList(new Method('pan', [], null, [moveX, moveY, time, promise, swing, skip], lex, anim,
		"Move the background relative to current position horizontally by x amount (relative to VN Screen width) and vertically by y amount (relative to VN screen Height). "
	), bgList);
	addMethodToList(new Method('shiftBackground', ['shift', 'jump'], null, [moveX, moveY, time, promise, swing, skip], lex, anim,
		"Move the background from the original position horizontally by x amount (relative to VN Screen width) and vertically by y amount (relative to VN screen Height)."
	), bgList);
	addMethodToList(new Method('scaleBackground', ['scale'], null, [scaleX, scaleY, time, promise, swing, skip], lex, anim,
		"Scale the background base on the current background width and height by the given factor in the given time"
	), bgList);
	addMethodToList(new Method('skewBackground', ['skew'], null, [XSkew, YSkew, time, promise, swing, skip], lex, anim,
		"Skew the character in the given time"
	), bgList);
	addMethodToList(new Method('flipBackgroundVertically', ['flipVertically'], null, [promise, time, swing, skip], lex, anim,
		'Flips/mirror the background vertically. (up-down). This is relative to its current flip status.'
	), bgList);
	addMethodToList(new Method('flipBackgroundHorizontally', ['flipHorizontally'], null, [promise, time, swing, skip], lex, anim,
		'Flips/mirror the background vertically. (left-right). This is relative to its current flip status.'
	), bgList);
	addMethodToList(new Method('animate', [], null, [time, promise, swing, skip], lex, anim,
		"The background will animate from its screen values to whatever values it has. This method is a one-size-fit-all method for animating. Use setters, pre-animations and chain constructors to change the value (they do not directly apply to the background on screen), and call this function to transform this background to whatever new values is! "
	), bgList);
	addMethodToList(new Method('resetStage', [], null, [time, promise, swing, skip], lex, anim,
		"This will reset the background to its default state (all values), and animate it to that state. See background-defaults. "
	), bgList);
	//instants
	addMethodToList(new Method('closeTextBox', [], null, [promise], lex, inst,
		"Closes the text box instantly"
	), bgList);
	addMethodToList(new Method('displayOption', [], null, [options, promise], lexer, inst,
		"Display Options in the option array"
	), bgList);
	addMethodToList(new Method('displayOptionPrecise', [], null, [options, optionFS, optionW, optionPad, optionMargin, optionColumns, promise], lex, inst,
		"Display with precise requirement, grid wise, with predefined columns and margin etc"
	), bgList);
	addMethodToList(new Method('setOption', [], null, [options, optionX, optionY, optionW, optionW, optionPad], lex, set,
		"Pre-set a option at a precise location, to be displayed when displayOption method is called."
	), bgList);
	addMethodToList(new Method('displayMarker', [], null, [promise], lex, inst,
		"Show a completion marker (green for frame ended, red for frame not ended)."
	), bgList);
	addMethodToList(new Method('removeMarker', [], null, [promise], lex, inst,
		"Close the completion marker."
	), bgList);
	//frills
	addMethodToList(new Method('glitch', [], null, [], lex, fr,
		"Glitches the background"
	), bgList);
	addMethodToList(new Method('trigger', [], null, [time, promise, skip, shake, delay], lex, fr,
		"Shakes the background"
	), bgList);
	addMethodToList(new Method('earthquake', [], null, [time, promise, skip, shake, delay], lex, fr,
		"Shakes the whole engine (textbox, character everything)"
	), bgList);
	//multithread
	addMethodToList(new Method('waitFor', [], null, [gameInstance, promise], lexer, o,
		"Make this thread wait until another thread notifies this thread."
	), bgList);
	addMethodToList(new Method('notifyWaiter', ['notify'], null, [gameInstance], lexer, o,
		"Notify the a thread that may be waiting for this thread."
	), bgList);
	//globals
	addMethodToList(new Method('display', ['show'], null, [bgA, bdA, time, promise, swing, skip], lex, gg,
		"Sets the current stage to active. If there is a previous stage, the previous stage's background, overlay and cover will fade out (within the first half of the time) and fade in the background to bkgdAlpha value and animate the backdrop's opacity to bkdpAlpha in the second half to the time. If there is not previous stage, the current background and backdrop will fade in to bkgdAlpha opacity and bkdpAlpha opacity respectively. "
	), bgList);
	addMethodToList(new Method('unDisplay', ['hide'], null, [time, promise, swing, skip, offBackdrop], lex, gg,
		"Remove the current stage as the active stage. Fade the background out. Put last parameter to true if you want the backdrop to fadeout too. This will automatically fade overlay and cover out "
	), bgList);
	addMethodToList(new Method('bringCharacter', ['bring'], null, [char, promise], lexer, gg,
		"Brings the character onto the stage. If the stage is not active (. display() is not called yet), nothing happens on screen, and the character is added to the stage (the character will be animate-able once .display() is called). If it is called while the stage is active, the character will be instantly brought to the screen with all its values applied. If this character belongs to another stage prior to this, it is automatically removed from the stage "
	), bgList);
	addMethodToList(new Method('removeCharacter', ['remove'], null, [char, promise], lexer, gg,
		"Removes the character from the stage. If the stage is not active (. display() is not called yet), nothing happens on the screen, which the character is removed from stage (when .displayed() is called, you cannot make the character appear because its not on the stage). If it is called while the stage is active, the character will be instantly removed from the screen. "
	), bgList);
	return bgList;
}

function initAllMethods(charList, bgList, conList) {
	charList = initCharacter(charList);
	bgList = initBackground(bgList);
	conList = initConstructor(conList);
	return [charList, bgList, conList];
}

function registerMacro(lines) {
	var marcoList = {};
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].code;
		var index = lines[i].index;
		var args = line.split(' ');
		var cmd = args.shift().trim();
		//console.log("Arg",cmd, i, lines[i].index);
		if (cmd === "macro") {
			//console.log("Is Macro: ", i)
			lines.splice(i, 1);
			i--;
			var marcoCmd = args.shift().trim();
			var s = numberOfSpaces(line);
			var l = [];
			i++
			while (numberOfSpaces(lines[i].code) > s) {
				//console.log("pushing:",i,lines[i])
				l.push(lines[i]);
				lines.splice(i, 1);
			}
			i--
			if (marcoList[marcoCmd] !== null && typeof marcoList[marcoCmd] !== "undefined") {
				throw new Error("Macro already exist, please change macro name! Line " + index);
			}
			marcoList[marcoCmd] = new Macro(marcoCmd, args, l);
		}
	}
	return [lines, marcoList];
}

function stripSingleComments(string) {
	var index = string.index;
	string = string.code;
	var cPos = 0;

	function cChar() {
		return string.charAt(cPos);
	}
	while (cPos < string.length) {
		if (cChar() === '/' && string.charAt(cPos + 1) === "/") {
			return {
				index: index,
				code: string.substring(0, cPos)
			};
		}
		cPos++;
	}
	return {
		index: index,
		code: string
	};
}

function uniq(a) {
	return a.sort().filter(function(item, pos, ary) {
		return !pos || item != ary[pos - 1];
	})
}

function getJSON(o) {
	var r = {};
	for (var x in o) {
		var method = o[x];
		var key = method.key;
		var alias = method.alias;
		alias.push(key);
		var argArray = [];
		var code = method.realName + "("
		for (var i = 0; i < method.order.length; i++) {
			arg = method.order[i];
			var aName = arg.key;
			var aLias = arg.alias;
			aLias.push(arg.key);
			var type = arg.dtype;
			var desc = arg.des;
			var aV = arg.acceptedValues;
			aLias = uniq(aLias);
			var ao = {
				name: aName,
				alias: aLias,
				type: type,
				desc: desc,
				accepted: aV
			}
			argArray.push(ao);
			code += (i === 0 ? "" : ",") + arg.key;
		}
		code += ");"
		var isSingle = method.isSingleArg();
		var type = method.type;
		var des = method.des;
		alias = uniq(alias);
		var obj = {
			alias: alias,
			name: key,
			code: code,
			single: isSingle,
			type: type,
			desc: des,
			arg: argArray
		};
		r[key] = obj;
	}
	return r;
}

function parseDefintions(lines) {
	var gameObjectList = {};
	var variableList = {};
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].code;
		var index = lines[i].index;
		var args = line.split(' ')
			.filter(d => d !== null && typeof d === "string" && d.trim() !== "");
		var key = args[0];
		if(key.trim() === "create"){
			if(args.length < 4){
				throw new Error('Syntax Error: Creation of objection is incorrect. Too little arguments. Line: ' + index);
			}
			var type = args[1].trim();
			var name = args[2].trim();

			switch(type){
				case "stage":
				case "character":
				case "sound":
				case "option":
					if(gameObjectList[name] !== null && typeof gameObjectList[name] !== "undefined"){
						throw new Error('GameObject '+name+ ' has already been declared! at Line '+ index);
					}
					gameObjectList[name] = new GameObject(gameobj, type);
					break;
				default:
					throw new Error('Unsupported Operation: No such object type: '+ type, "; at Line "+ index);
			}
		}

		if (key.trim() === "declare" || key.trim() === "dec") {
			if (args.length !== 4) {
				throw new Error('Syntax Error: Declaration of gameobject is incorrect! Argument mismatch:' + args.length + " at Line " + index);
			}
			if (args[2] !== "as") {
				throw new Error('Known keyword ' + args[2] + " at Line " + index);
			}
			var obj = args[1].split(',');
			for (var k in obj) {
				var gameobj = obj[k].trim();
				if (gameObjectList[gameobj] !== null && typeof gameObjectList[gameobj] !== "undefined") {
					throw new Error('GameObject ' + gameobj + ' has already been declared!' + " at Line " + index);
				}
				gameObjectList[gameobj] = new GameObject(gameobj, args[3].trim());
			}
			lines.splice(i, 1);
			i--;
		}
		if (key.trim() === 'let') {
			if (args.length !== 6) {
				throw new Error('Syntax Error: Initialization of variable is incorrect! Argument mismatch: ' + args.length + " at Line " + index);
			}
			if (args[2] !== "be") {
				throw new Error("Syntax Error: Uknown keyword: " + args[2] + " at Line " + index);
			}
			if (args[4] !== "as") {
				throw new Error("Syntax Error: Uknown keyword: " + args[4] + " at Line " + index);
			}
			var type = args[5].trim();
			if (type !== "string" && type !== "number" && type !== "boolean" && type !== "object") {
				throw new Error("Syntax Error: Unknown type: " + args[5] + ";" + " at Line " + index);
			}
			var vars = args[1].split(',');
			for (var k in vars) {
				var vari = vars[k].trim();
				if (variableList[vari] !== null && typeof variableList[vari] !== "undefined") {
					throw new Error('Variable ' + vari + " has already been initialized!" + " at Line " + index);
				}
				variableList[vari] = new Variable(vari, args[3].trim(), args[5]);
			}
		}
	}
	return [lines, gameObjectList, variableList];
}

gulp.task('generate', function(done) {
	var arr = initAllMethods([], []);
	var char = getJSON(arr[0]);
	var bg = getJSON(arr[1]);
	var obj = {
		char: char,
		bg: bg
	}
	var s = JSON.stringify(obj);
	fs.writeFile('methods.json', s, function(err) {
		if (err) {
			return console.log(err);
		}
	});
	done();
})

gulp.task('watch', function() {
	var watcher = gulp.watch('../kvn/scripts/**/*.kvn', gulp.parallel('series'));
	watcher.on('change', function(path, stats) {
		console.log('File ' + path + ' was changed');
		gulp.parallel('series')
	});
	watcher.on('unlink', function(path) {
		console.log('File ' + path + ' was removed');
	});
});

gulp.task('clean', function() {
	return del('export');
});

gulp.task('exportseq', function() {
	var a = new Promise(function(resolve) {
		return gulp.src(['compiler.bat', 'gulpfile.js', 'install.bat', 'methods.json', 'package.json']).pipe(gulp.dest('export')).on('end', resolve);
	});
	var b = new Promise(function(resolve) {
		return gulp.src(['interpreter/**/*.*']).pipe(gulp.dest('export/interpreter')).on('end', resolve);
	});
	return Promise.all([a, b])
});

gulp.task('export', gulp.series('clean', 'exportseq'))

gulp.task('default', gulp.parallel('series', 'watch'));
