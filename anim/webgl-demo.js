var cubeRotation = 0.0;
const projectionMatrix = mat4.create();
const viewMatrix = mat4.create();

var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;
var mouseX = null;
var mouseY = null;
var lastPlaneX = null;
var lastPlaneY = null;
var planeX = null;
var planeY = null;
var canvas;

var pointScale = 0.075;
var pointDelt = 0.001;

var centers = [ [2.0, 0.0] ];
var states = [ 0 ];
var textures = [];
var selected = -1;

const fieldOfView = 45 * Math.PI / 180;   // in radians
var aspect;
const cameradist = 8.0;
const zNear = 0.1;
const zFar = 100.0;
	
main();
//
// Start here
//
function main() {
  canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl');
  aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	canvas.onmousedown = handleMouseDown;
	document.onmouseup = handleMouseUp;
	document.onmousemove = handleMouseMove;

  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }
  
  //console.log((2.0 / pointScale + pointDelt));

  // Vertex shader program

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

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);
  const texture = loadTexture(gl, 'https://i.imgur.com/gpsVFuq.png');

  textures.push(texture);
  
  initMatrix(gl);
  var then = 0;
  // Draw the scene repeatedly
  function render() {
    //now *= 0.001;  // convert to seconds
    //const deltaTime = now - then;
    //then = now;
	
	drawNewFrame(gl);
    drawSceneTexture(gl, programInfo, buffers);
    drawSceneBox(gl, programInfoBox, buffers);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function handleMouseDown(event) {
	mouseDown = true;
	lastMouseX = event.clientX;
	lastMouseY = event.clientY;
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

function handleMouseMove(event) {
    var rect = canvas.getBoundingClientRect();
	var width = rect.right - rect.left;
	var height = rect.bottom - rect.top;
	/*
	if (!mouseDown) {
		return;
	}
	*/
	mouseX = event.clientX - rect.left;
	mouseY = event.clientY - rect.top;
	
	mouseX = mouseX - (width / 2);
	mouseY = mouseY - (height / 2);
	
	var plane = calculateTrueXY();
	planeX = plane.x;
	planeY = -plane.y;
	//console.log(planeX, planeY);
	
	//var deltaX = mouseX - lastMouseX;
	//var deltaY = mouseY - lastMouseY;
	
	if (mouseDown) {
		var deltaX = planeX - lastPlaneX;
		var deltaY = planeY - lastPlaneY;
	
		console.log(deltaX, deltaY);
		
		if(selected > -1) {
			centers[selected][0] += deltaX;
			centers[selected][1] += deltaY;
		}
	} else {
		updateMouseOver();
	}
	
	//lastMouseX = mouseX;
	//lastMouseY = mouseY;
	lastPlaneX = planeX;
	lastPlaneY = planeY;
}

function updateMouseOver() {
	var i;
	var cLen = centers.length;
	var fudge = 1.1;
	selected = -1;
	for (i = 0; i < cLen; i++) {
		//console.log(Math.abs(centers[i][0] - planeX), Math.abs(centers[i][1] - planeY));
		if (Math.abs(centers[i][0] - planeX) < pointScale * fudge && 
			Math.abs(centers[i][1] - planeY) < pointScale * fudge) {
			states[i] = 1;
			selected = i;
		}
		else
			states[i] = 0;
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
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple three-dimensional cube.
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

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Now set up the texture coordinates for the faces.

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

  const textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
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

  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
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
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
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
	
  var uColor;
  if (states[0] == 0)
	uColor = [0.0, 0.0, 1.0, 1.0];
  else
    uColor = [0.0, 1.0, 0.0, 1.0];
  gl.uniform4fv(
      programInfo.uniformLocations.uColor,
      uColor);
	
  const modelMatrix = mat4.create();
  var modelX = centers[0][0];
  var modelY = centers[0][1];
  mat4.translate(modelMatrix,
				 modelMatrix,
				 [modelX,modelY,0.01]);
  mat4.scale(modelMatrix,
			 modelMatrix,
			 [pointScale, pointScale, pointScale]);
  /*
  mat4.translate(modelMatrix,
				 modelMatrix,
				 [0.0,0.0,(2.0 / pointScale + pointDelt)]);
  */
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
  var modelX = centers[0][0];
  var modelY = centers[0][1];
  mat4.translate(modelMatrix,
				 modelMatrix,
				 [modelX,modelY,0.0]);
  mat4.rotate(modelMatrix,  // destination matrix
              modelMatrix,  // matrix to rotate
              3.14159,     // amount to rotate in radians
              [0, 0, 1]);       // axis to rotate around (Z)

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

