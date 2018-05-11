var cubeRotation = 0.0;
const projectionMatrix = mat4.create();
const viewMatrix = mat4.create();
const viewMatrixClose = mat4.create();

const rotCtrlLen = 1.1;

var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;
var mouseX = null;
var mouseY = null;
var lastPlaneX = null;
var lastPlaneY = null;
var planeX = null;
var planeY = null;
var lastFlatX = null;
var lastFlatY = null;
var flatX = null;
var flatY = null;
var canvas;

var editing = true;
var playing = false;
var time = 0.0;

var pointScale = 0.075;
var pointDelt = 0.001;

var width;

var frames = [];
var frame_sel = -1;
var frame_pick = -1;
var mouseOverTimeline = false;

var maxTime = 10.0;

textures = []
var currFrame = {
	cen : [ {x : 2.0, y: 0.0, state : 0 } ],
	rot : [ { theta: 0.0, x: 2.0 + rotCtrlLen, y: 0.0, state: 0 } ],
ctrl : [ [ 
			   { rel_x : 0.5, rel_y :0.5 },
			   { rel_x : -0.5, rel_y :0.5 },
			   { rel_x : 0.5, rel_y :-0.5 },
			   { rel_x : -0.5, rel_y :-0.5 }
			   
] ],
	sel : { index : -1, list : "" }
};

const fieldOfView = 45 * Math.PI / 180;   // in radians
var aspect;
const cameradist = 8.0;
const zNear = 0.1;
const zFar = 100.0;

var lastTime;
const timelineHeight = 15;
const cursorWidth = 2;
const keyWidth = 4;

main();


function startTimer() {
	lastTime = new Date().getTime();
	playing = true;
	frame_pick = -1;
	if (frames.length > 0) {
		if (time >= frames[frames.length-1].time)
			time = 0;
	}
}

function stopTimer() {
	playing = false;
}

function updateTime() {
	if (frames.length > 0) {
		var now = new Date().getTime();
		var delta = (now - lastTime) / 1000.0;
		time += delta;
		//console.log(time);
		lastTime = now;
		if(time >= frames[frames.length-1].time) {
			//console.log(time, frames[frames.length-1].time)
			time = frames[frames.length-1].time;
			stopTimer();
		}
	}
}

function updateCtrl(frame) {
	var i;
	var j;
	for (i = 0; i < frame.cen.length; ++i) {
		frame.rot[i].x = frame.cen[i].x + Math.cos(frame.rot[i].theta) * rotCtrlLen;
		frame.rot[i].y = frame.cen[i].y + Math.sin(frame.rot[i].theta) * rotCtrlLen;
	}
	for (i = 0; i < frame.cen.length; ++i) {
		var theta = frame.rot[i].theta;
		var cos_t = Math.cos(theta);
		var sin_t = Math.sin(theta);
		for(j = 0; j < frame.ctrl[i].length; ++j) {
			var rel_x = frame.ctrl[i][j].rel_x;
			var rel_y = frame.ctrl[i][j].rel_y;
			frame.ctrl[i][j].x = frame.cen[i].x + (cos_t * rel_x - sin_t * rel_y);
			frame.ctrl[i][j].y = frame.cen[i].y + (sin_t * rel_x + cos_t * rel_y);
		}
	}
	return frame;
}

function main() {
	canvas = document.querySelector('#glcanvas');
	const gl = canvas.getContext('webgl');
	aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	canvas.onmousedown = handleMouseDown;
	document.onmouseup = handleMouseUp;
	document.onmousemove = handleMouseMove;
	document.onkeydown = handleKeyDown;
	document.onkeyup = handleKeyUp;
	
  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }
  
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;

    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 vTextureCoord;

    void main(void) {
      gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

  const vsSourceLine = `
    attribute vec4 aVertexPosition;
	
    uniform mat4 uModelMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uProjectionMatrix;

    uniform vec4 uVertexA;
    uniform vec4 uVertexB;
	
    void main(void) {
	  if (aVertexPosition.x > 0.5)
		gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * uVertexA;
	  else
		gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * uVertexB;	
    }
  `;
  
  // Fragment shader program

  const fsSource = `
    varying highp vec2 vTextureCoord;

    uniform sampler2D uSampler;

    void main(void) {
      gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
  `;

  const fsSourceBox = `
    precision mediump float;
	uniform vec4 uColor;
	
	void main(void) {
      gl_FragColor = uColor;
    }
  `;
  
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelMatrix: gl.getUniformLocation(shaderProgram, 'uModelMatrix'),
      viewMatrix: gl.getUniformLocation(shaderProgram, 'uViewMatrix'),
      uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
    },
  };
  
  const shaderProgramBox = initShaderProgram(gl, vsSource, fsSourceBox);
  const programInfoBox = {
    program: shaderProgramBox,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgramBox, 'aVertexPosition'),
      textureCoord: gl.getAttribLocation(shaderProgramBox, 'aTextureCoord'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgramBox, 'uProjectionMatrix'),
      modelMatrix: gl.getUniformLocation(shaderProgramBox, 'uModelMatrix'),
      viewMatrix: gl.getUniformLocation(shaderProgramBox, 'uViewMatrix'),
      uColor: gl.getUniformLocation(shaderProgramBox, 'uColor'),
    },
  };

  const shaderProgramLine = initShaderProgram(gl, vsSourceLine, fsSourceBox);
  const programInfoLine = {
    program: shaderProgramLine,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgramLine, 'aVertexPosition'),
      textureCoord: gl.getAttribLocation(shaderProgramLine, 'aTextureCoord'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgramLine, 'uProjectionMatrix'),
      modelMatrix: gl.getUniformLocation(shaderProgramLine, 'uModelMatrix'),
      viewMatrix: gl.getUniformLocation(shaderProgramLine, 'uViewMatrix'),
      uColor: gl.getUniformLocation(shaderProgramLine, 'uColor'),
	  uVertexA: gl.getUniformLocation(shaderProgramLine, 'uVertexA'),
	  uVertexB: gl.getUniformLocation(shaderProgramLine, 'uVertexB'),
    },
  };
  
  
  
  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);
  const lineBuffers = initLineBuffers(gl);
  const texture = loadTexture(gl, 'https://i.imgur.com/MNeH7XY.jpg');

  textures.push(texture);
  
  initMatrix(gl);
  var then = 0;
  // Draw the scene repeatedly
  function render() {
    //now *= 0.001;  // convert to seconds
    //const deltaTime = now - then;
    //then = now;
	
	if (editing) {
		currFrame = updateCtrl(currFrame);
	}
	
	drawNewFrame(gl);
	if (playing) {
		updateTime();
		currFrame = interp(time);
	}
	//drawSceneTexture(gl, programInfo, buffers);
	drawSceneLine(gl, programInfoLine, lineBuffers);
	drawSceneBox(gl, programInfoBox, buffers);
	drawSceneTimeline(gl, programInfoBox, buffers);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function updateMaxTime() {
	maxTime = 10.0;
	if(frames.length > 0 && frames[frames.length-1].time > maxTime)
		maxTime = frames[frames.length-1].time;
}

function addFrameEnd() {
	var newFrame = JSON.parse(JSON.stringify(currFrame));
	newFrame.time = frames.length * 1.0;
	console.log("new frame time ",newFrame.time);
	
	frames.push(newFrame);
	time = newFrame.time;
	frame_pick = frames.length - 1;
	
	editing = false;
	playing = false;
	updateMaxTime();
}  

function interp_ab(a,b,last,next) {
	//console.log("interp_ab",a,last.time,next.time);
	var result = JSON.parse(JSON.stringify(last));
	for (i = 0; i < result.cen.length; ++i) {
		result.cen[i].x = a * last.cen[i].x + b * next.cen[i].x;
		result.cen[i].y = a * last.cen[i].y + b * next.cen[i].y;
		if (Math.abs(last.rot[i].theta - next.rot[i].theta) < Math.abs(last.rot[i].theta - (next.rot[i].theta + 2 * 3.14159)))
			result.rot[i].theta = a * last.rot[i].theta + b * next.rot[i].theta;
		else
			result.rot[i].theta = a * last.rot[i].theta + b * (2 * 3.14159 + next.rot[i].theta);
	}
	result.sel.index = -1;
	//console.log(last.cen[0]);
	//console.log(next.cen[0]);
	//console.log(result.cen[0]);
	result = updateCtrl(result);
	return result;
}

function interp(time) {
		//console.log("interp",time);
	if (frames.length == 0) {
		return currFrame;
	}
	if (time <= frames[0].time) {
		//console.log("low", frames[0].time);
		return frames[0];
	}
	if (time >= frames[frames.length - 1].time) {
		//console.log("high ", time, frames[frames.length - 1].time);
		return frames[frames.length - 1];
		//return frames[frames.length - 1];
	}
		
	
	for (i = 0; i < frames.length; ++i) {
		if (time >= frames[i].time && time <= frames[i+1].time)
			break;
	}
	
	var last_index = i;
	var next_index = i + 1;
	var last_frame = frames[last_index];
	var next_frame = frames[next_index];

	var d = next_frame.time - last_frame.time;
	var a = 1.0 - ((time - last_frame.time) / d);
	var b = 1.0 - a;
	
	return interp_ab(a,b,last_frame,next_frame);
}

function setTime(newTime, edit) {
	if (newTime < 0) newTime = 0;
	time = newTime;
	currFrame = interp(newTime);
	editing = edit;
	console.log(time);
}

function deleteFrame() {
		return;
	if(frame_pick == -1)
		
	frames.splice(frame_pick,1);
	currFrame = interp(time);
	
	frame_pick = -1;
	frame_sel = -1;
	updateMaxTime();
}

function updateFrame() {
	editing = false;
	playing = false;
	
	// check if cursor is too close to a frame
	var pseudo_pick = -1;
	for(var i = 0; i < frames.length; ++i) {
		if (Math.abs(time - frames[i].time) < 0.05)
			pseudo_pick = i;
	}
	if(pseudo_pick > -1 && frame_pick == -1)
		frame_pick = pseudo_pick;
		
	if(frame_pick > -1) {
		var frameTime = frames[frame_pick].time;
		frames[frame_pick] = JSON.parse(JSON.stringify(currFrame));
		frames[frame_pick].time = frameTime;
		//console.log("frame_pick");
	} else {
		// insert new frame
		var newFrame = JSON.parse(JSON.stringify(currFrame));
		//var newFrame = currFrame;
		newFrame.time = time;
		console.log(frames[frames.length - 1].time, time)
		if (time <= frames[0].time) {
			// beginning
			frames.unshift(newFrame);
			frame_pick = 0;
		} else if (frames.length == 0  || time >= frames[frames.length - 1].time) {
			// end
			console.log("insert high");
			frames.push(newFrame);
			frame_pick = frames.length - 1;
			return frames[frames.length - 1];
			//return frames[frames.length - 1];
		} else {
			// middle, somewhere
			var i;
			for (i = 0; i < frames.length; ++i) {
				if (time >= frames[i].time && time <= frames[i+1].time)
					break;
			}
			// place it after i
			frames.splice(i + 1,0,newFrame);
			frame_pick = i + 1;
		}
		console.log(frames.length)
		//console.log(frame_pick);
	}
	
}

function handleKeyDown(event) {
	console.log(event.keyCode);
	var code = event.keyCode;
	if(code == 70) { // F
		addFrameEnd();
		//console.log(frames);
	} else if (code == 37) { // leftArrow
		setTime(time - 0.05, false);
		frame_pick = -1;
	} else if (code == 39) { // rightArrow
		setTime(time + 0.05, false);
		frame_pick = -1;
	} else if (code == 40) { // upArrow
		if(frames.length > 0) {
			setTime(frames[frames.length-1].time, false);
			frame_pick = frames.length-1;
		}
	} else if (code == 38) { // downArrow
		setTime(0, false);
		if(frames.length > 0)
			frame_pick = 0;
	} else if (code == 32) { // space
		if(!playing) {
			startTimer();
		} else {
			stopTimer();
		}
	} else if (code == 46) { // delete
		deleteFrame();
	} else if (code == 90) { // x
		editing = false;
		currFrame = interp(time);
	} else if (code == 71) { // g
		console.log("update");
		updateFrame();
	} else if (code == 80) { // p
		var my_str = "";
		for (var j = 0; j < currFrame.ctrl[0].length; ++j) {
			my_str += ("{ rel_x : " + currFrame.ctrl[0][j].rel_x + ", rel_y : " + currFrame.ctrl[0][j].rel_y + "},\n");
		}
		console.log(my_str);
	} else if (code == 65) {
		currFrame.ctrl[0].push({ rel_x : 0.5, rel_y :0.5 });
		currFrame.ctrl[0].push({ rel_x : -0.5, rel_y :0.5 });
		currFrame.ctrl[0].push({ rel_x : 0.5, rel_y :-0.5 });
		currFrame.ctrl[0].push({ rel_x : -0.5, rel_y :-0.5 });
	}
}

function handleKeyUp(event) {

}

function handleMouseDownTimeline() {
	if(flatY > timelineHeight || flatY < 0) {
		return;
	}
	
	playing = false;
	if(frame_sel > -1) {
		frame_pick = frame_sel;
		time = frames[frame_sel].time;
		if(!editing)
			currFrame = interp(time);
		//console.log(time);
	} else {
		frame_pick = -1;
		var rect = canvas.getBoundingClientRect();
		var width = rect.right - rect.left;
		time = (flatX - keyWidth) * maxTime / (width - 2.0 * keyWidth);	
		if(!editing)
			currFrame = interp(time);
	}
}

function handleMouseDown(event) {
	mouseDown = true;
	lastMouseX = event.clientX;
	lastMouseY = event.clientY;
	
	handleMouseDownTimeline();
}

function handleMouseUp(event) {
	mouseDown = false;
}

function calculateTrueXY() {
    var rect = canvas.getBoundingClientRect();
	var width = rect.right - rect.left;
	var height = rect.bottom - rect.top;
	var angY = fieldOfView * mouseY / height;
	var angX = aspect * fieldOfView * mouseX / width;
	
	//console.log(Math.sin(angX),Math.sin(angY));
	
	return {
		x : Math.sin(angX) * cameradist * 1.085,
		y : Math.sin(angY) * cameradist * 1.085,
	};
}

function updateMouseOverTimeline() {
	if(flatY > timelineHeight || flatY < 0) {
		frame_sel = -1;
		return;
	}

    var rect = canvas.getBoundingClientRect();
	var width = rect.right - rect.left;
	var timeWidth = keyWidth * maxTime / (width - 2.0 * keyWidth);
	var mouseTime = (flatX - keyWidth) * maxTime / (width - 2.0 * keyWidth);	
	
	
	frame_sel = -1;
	for(var i = 0; i < frames.length; ++i) {
		if (Math.abs(frames[i].time - mouseTime) < timeWidth)
			frame_sel = i;
	}
}

function swapFrames(x,y) {
	var placeholder = JSON.parse(JSON.stringify(frames[x]));
	frames[x] = JSON.parse(JSON.stringify(frames[y]));
	frames[y] = JSON.parse(JSON.stringify(placeholder));
	
	if (frame_sel == x)
		frame_sel = y;
	else if (frame_sel == y) 
		frame_sel = x;
		
	if (frame_pick == x)
		frame_pick = y;
	else if (frame_pick == y)
		frame_pick = x;
	
	//console.log(frames);
}

function handleMouseMove(event) {
    var rect = canvas.getBoundingClientRect();
	var width = rect.right - rect.left;
	var height = rect.bottom - rect.top;
	
	flatX = event.clientX - rect.left;
	flatY = rect.bottom - event.clientY;
	
	mouseX = event.clientX - rect.left;
	mouseY = event.clientY - rect.top;
	
	mouseX = mouseX - (width / 2);
	mouseY = mouseY - (height / 2);
	
	var plane = calculateTrueXY();
	planeX = plane.x;
	planeY = -plane.y;
	
	if (mouseDown) {
		var deltaX = planeX - lastPlaneX;
		var deltaY = planeY - lastPlaneY;
	
		var deltaFlatX = flatX - lastFlatX;
		//console.log(deltaX, deltaY);
		
		if(frame_sel > -1) {
			console.log(frame_sel);
			frames[frame_sel].time += deltaFlatX * maxTime / (width - 2.0 * keyWidth);
			time = frames[frame_sel].time;
			if(frame_sel < frames.length - 1) {
				if(frames[frame_sel].time > frames[frame_sel + 1].time) {
					swapFrames(frame_sel, frame_sel + 1);
				}
			}
			if (frame_sel > 0) {
				if(frames[frame_sel].time < frames[frame_sel - 1].time) {
					swapFrames(frame_sel - 1, frame_sel);
				}
			}
			updateMaxTime();
		}
		
		if(currFrame.sel.index > -1) {
			updateControl(deltaX, deltaY);
		}
	} else {
		updateMouseOver();
		updateMouseOverTimeline();
	}
	
	lastPlaneX = planeX;
	lastPlaneY = planeY;
	lastFlatX = flatX;
	lastFlatY = flatY;
}

function updateControl(deltaX, deltaY) {
	editing = true;
	var i = currFrame.sel.index;
	var j = currFrame.sel.index_2;
	if (currFrame.sel.list == "cen") {
		currFrame.cen[i].x += deltaX;
		currFrame.cen[i].y += deltaY;
	}
	else if (currFrame.sel.list == "rot") {
		var dX = currFrame.rot[i].x + deltaX - currFrame.cen[i].x;
		var dY = currFrame.rot[i].y + deltaY - currFrame.cen[i].y;
		
		var len = dX * dX + dY * dY;
		len = Math.sqrt(len);
		
		if (dX == 0.0) {
			if (dY > 0)
				currFrame.rot[i].theta = 3.14159 / 2;
			else
				currFrame.rot[i].theta = -3.14159 / 2 	;
		} else {
			currFrame.rot[i].theta = Math.atan(dY / dX);
			if (dX < 0)
				currFrame.rot[i].theta += 3.1415;
		}
	}
	else {
		// rotate delta by negative theta, then apply
		var theta = currFrame.rot[i].theta;
		var cos_neg_t = Math.cos(-theta);
		var sin_neg_t = Math.sin(-theta);
		var dX = cos_neg_t * deltaX - sin_neg_t * deltaY;
		var dY = sin_neg_t * deltaX + cos_neg_t * deltaY;
		currFrame.ctrl[i][j].rel_x += dX;
		currFrame.ctrl[i][j].rel_y += dY;
	}
}

function updateMouseOver() {
	var i;
	var fudge = 1.1;
	currFrame.sel.index = -1;
	currFrame.sel.list = "";
	for (i = 0; i < currFrame.cen.length; i++) {
		if (Math.abs(currFrame.cen[i].x - planeX) < pointScale * fudge && 
			Math.abs(currFrame.cen[i].y - planeY) < pointScale * fudge) {
			currFrame.cen[i].state =  1;
			currFrame.sel.index = i;
			currFrame.sel.list = "cen";
		}
		else
			currFrame.cen[i].state = 0;
	}
	
	for (i = 0; i < currFrame.rot.length; i++) {
		if (Math.abs(currFrame.rot[i].x - planeX) < pointScale * fudge && 
			Math.abs(currFrame.rot[i].y - planeY) < pointScale * fudge) {
			currFrame.rot[i].state =  1;
			currFrame.sel.index = i;
			currFrame.sel.list = "rot";
		}
		else
			currFrame.rot[i].state = 0;
	}
	var j;
	for (i = 0; i < currFrame.ctrl.length; ++i) {
		for(j = 0; j < currFrame.ctrl[i].length; ++j) {
			var ctrlPt = currFrame.ctrl[i][j];
			if(Math.abs(ctrlPt.x - planeX) < pointScale * fudge &&
			   Math.abs(ctrlPt.y - planeY) < pointScale * fudge) {
				currFrame.ctrl[i][j].state = 1;
				currFrame.sel.index = i;
				currFrame.sel.index_2 = j;
				currFrame.sel.list = "ctrl";
			} else
				currFrame.ctrl[i][j].state = 0;
		}
	}
}
  
function requestCORSIfNotSameOrigin(img, url) {
  if ((new URL(url)).origin !== window.location.origin) {
    img.crossOrigin = "";
  }
}

function initMatrix(gl) {	
	mat4.perspective(projectionMatrix,
				   fieldOfView,
				   aspect,
				   zNear,
				   zFar);
	mat4.translate(viewMatrix,     // destination matrix
				 viewMatrix,     // matrix to translate
				 [-0.0, 0.0, -cameradist]);
	mat4.translate(viewMatrixClose,     // destination matrix
				 viewMatrixClose,     // matrix to translate
				 [-0.0, 0.0, -0.2]);
}

function initLineBuffers(gl) {

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [
    0.0, 0.0, 0.0, 
	1.0, 0.0, 0.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  const indices = [ 0,  1, ];
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    indices: indexBuffer,
  };
}

//
// initBuffers
//
function initBuffers(gl) {

  // Create a buffer for the cube's vertex positions.

  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the cube.

  const positions = [
    // Front face
    -1.0, -1.0,  0.0,
     1.0, -1.0,  0.0,
     1.0,  1.0,  0.0,
    -1.0,  1.0,  0.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Now set up the texture coordinates for the faces.

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

  const textureCoordinates = [
    // Front
    1.0,  0.0,
    0.0,  0.0,
    0.0,  1.0,
    1.0,  1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex arrays for each face's vertices.

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  const indices = [
    0,  1,  2,      0,  2,  3,    // front
  ];

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    textureCoord: textureCoordBuffer,
    indices: indexBuffer,
  };
}

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);

  const image = new Image();
  image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, image);

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
       // Yes, it's a power of 2. Generate mips.
       gl.generateMipmap(gl.TEXTURE_2D);
    } else {
       // No, it's not a power of 2. Turn of mips and set
       // wrapping to clamp to edge
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
  
  //requestCORSIfNotSameOrigin(image, url);
    image.crossOrigin = "";
  image.src = url;

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

function drawNewFrame(gl) {
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function drawSceneBox(gl, programInfo, buffers) {

  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);
  
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.viewMatrix,
      false,
	  viewMatrix);
	
  // draw centers
  var uColor;
  if (currFrame.cen[0].state != 0)
    uColor = [0.0, 1.0, 0.0, 1.0];
  else if (editing)
	uColor = [0.0, 0.0, 1.0, 1.0];
  else
    uColor = [1.0, 1.0, 0.0, 1.0];
  gl.uniform4fv(
      programInfo.uniformLocations.uColor,
      uColor);
  var modelMatrix = mat4.create();
  var modelX = currFrame.cen[0].x;
  var modelY = currFrame.cen[0].y;
  mat4.translate(modelMatrix,
				 modelMatrix,
				 [modelX,modelY,0.01]);
  mat4.scale(modelMatrix,
			 modelMatrix,
			 [pointScale, pointScale, pointScale]);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelMatrix,
      false,
      modelMatrix);
  {
    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
  
  // draw rot
  var uColor;
  if (currFrame.rot[0].state == 0)
	uColor = [1.0, 0.0, 1.0, 1.0];
  else
    uColor = [0.0, 1.0, 0.0, 1.0];
  gl.uniform4fv(
      programInfo.uniformLocations.uColor,
      uColor);
  var modelMatrix = mat4.create();
  var modelX = currFrame.rot[0].x;
  var modelY = currFrame.rot[0].y;
  mat4.translate(modelMatrix,
				 modelMatrix,
				 [modelX,modelY,0.01]);
  mat4.scale(modelMatrix,
			 modelMatrix,
			 [pointScale, pointScale, pointScale]);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelMatrix,
      false,
      modelMatrix);
  {
    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
  
  // draw ctrl points
  var j;
  for(j = 0; j < currFrame.ctrl[0].length; ++j) {  
	  // draw rot
	  var uColor;
	  if (currFrame.ctrl[0][j].state == 0)
		uColor = [1.0, 0.0, 0.0, 1.0];
	  else
		uColor = [0.0, 1.0, 0.0, 1.0];
	  gl.uniform4fv(
		  programInfo.uniformLocations.uColor,
		  uColor);
	  var modelMatrix = mat4.create();
	  var modelX = currFrame.ctrl[0][j].x;
	  var modelY = currFrame.ctrl[0][j].y;
	  mat4.translate(modelMatrix,
					 modelMatrix,
					 [modelX,modelY,0.01]);
	  mat4.scale(modelMatrix,
				 modelMatrix,
				 [pointScale, pointScale, pointScale]);
	  gl.uniformMatrix4fv(
		  programInfo.uniformLocations.modelMatrix,
		  false,
		  modelMatrix);
	  {
		const vertexCount = 6;
		const type = gl.UNSIGNED_SHORT;
		const offset = 0;
		gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
	  }
  }
}

function drawSceneTimeline(gl, programInfo, buffers) {
  gl.viewport(0, 0, gl.drawingBufferWidth, timelineHeight);
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);
 
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.viewMatrix,
      false,
	  viewMatrixClose);
	
  // draw centers
  var uColor;
  uColor = [0.3, 0.3, 0.3, 1.0];
  gl.uniform4fv(
      programInfo.uniformLocations.uColor,
      uColor);
  var modelMatrix = mat4.create();
  /*
  var modelX = currFrame.cen[0].x;
  var modelY = currFrame.cen[0].y;
  mat4.translate(modelMatrix,
				 modelMatrix,
				 [modelX,modelY,0.01]);
  mat4.scale(modelMatrix,
			 modelMatrix,
			 [pointScale, pointScale, pointScale]);
  */
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelMatrix,
      false,
      modelMatrix);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

	
  // draw keyframe markers
  var i;
  for(i = 0; i < frames.length; ++i) {
	uColor = [1.0, 1.0, 0.25, 1.0];
	if(frame_sel == i || frame_pick == i)
		uColor = [0.0, 1.0, 0.0, 1.0];
	gl.uniform4fv(
		programInfo.uniformLocations.uColor,
		uColor);
    var percent = frames[i].time / maxTime;
	var left = percent * (gl.drawingBufferWidth - 2 * keyWidth);
	gl.viewport(left, 0, 2 * keyWidth, timelineHeight-2);
  
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  

  // draw cursor
  uColor = [1, 1, 1, 1.0];
  gl.uniform4fv(
      programInfo.uniformLocations.uColor,
      uColor);
  var percent = time / maxTime;
  var left = percent * (gl.drawingBufferWidth - 2 * keyWidth);
  left = left + keyWidth - cursorWidth;
	gl.viewport(left, 0, 2 * cursorWidth, timelineHeight-2);
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function drawSceneLine(gl, programInfo, buffers) {
  gl.lineWidth(1.0);
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.viewMatrix,
      false,
	  viewMatrix);
	
  // draw centers
  var uColor;
  uColor = [1.0, 1.0, 0.0, 1.0];
  gl.uniform4fv(programInfo.uniformLocations.uColor, uColor);
	var modelMatrix = mat4.create();
	mat4.translate(modelMatrix, modelMatrix, [0.0,0.0,0.01]);
	gl.uniformMatrix4fv( programInfo.uniformLocations.modelMatrix, false, modelMatrix);
	var uVertexA = [currFrame.cen[0].x, currFrame.cen[0].y, 0.0, 1.0];
	var uVertexB = [currFrame.rot[0].x, currFrame.rot[0].y, 0.0, 1.0];
  gl.uniform4fv(programInfo.uniformLocations.uVertexA,uVertexA);
  gl.uniform4fv(programInfo.uniformLocations.uVertexB,uVertexB);
  {
    const vertexCount = 2;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.LINES, vertexCount, type, offset);
  }
}

function drawSceneTexture(gl, programInfo, buffers) {
  
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
        programInfo.attribLocations.textureCoord,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.textureCoord);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.viewMatrix,
      false,
      viewMatrix);

  const modelMatrix = mat4.create();
  var modelX = currFrame.cen[0].x;
  var modelY = currFrame.cen[0].y;
  mat4.translate(modelMatrix,
				 modelMatrix,
				 [modelX,modelY,0.0]);
  mat4.rotate(modelMatrix,  // destination matrix
              modelMatrix,  // matrix to rotate
              3.14159,     // amount to rotate in radians
              [0, 0, 1]);       // axis to rotate around (Z)
  mat4.rotate(modelMatrix,  // destination matrix
              modelMatrix,  // matrix to rotate
              currFrame.rot[0].theta,     // amount to rotate in radians
              [0, 0, 1]);       // axis to rotate around (Z)
  mat4.scale(modelMatrix,
			 modelMatrix,
			 [3.0,2.0,1.0]);
  mat4.scale(modelMatrix,
			 modelMatrix,
			 [1.1,1.1,1.1]);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelMatrix,
      false,
      modelMatrix);
	  
  var texture = textures[0];
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

  {
    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

