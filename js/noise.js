/* 0z5a-style background grain.
   Ported from the scene fragment shader: 1.5px grain, 3px scanlines,
   0.04 rolling band, rare 9fps white pixels. The canvas is transparent:
   only the grain/scanline/band pixels are painted, so the background's
   colour and material are left untouched. */
(function () {
  if (window.__spiritNoise) return;
  window.__spiritNoise = true;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.createElement('canvas');
  canvas.id = 'bg-noise';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false
  });
  if (!gl) return;

  var vs = [
    'attribute vec2 a;',
    'void main(){gl_Position=vec4(a,0.,1.);}'
  ].join('\n');

  var fs = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform float T;',
    'void main(){',
    '  vec2 x=gl_FragCoord.xy;',
    '  vec2 g=floor(x/1.5);',
    '  float n=fract(52.9829189*fract(dot(g,vec2(0.06711056,0.00583715))));',
    '  float d=n-0.5;',
    '  vec3 c=d>0.0?vec3(1.0):vec3(0.0);',
    '  float a=abs(d)*0.045;',
    '  float scan=step(0.5,fract(x.y/3.0));',
    '  if(scan<0.5){c=vec3(0.0);a=max(a,0.05);}',
    '  float band=smoothstep(0.94,1.0,fract(x.y*0.0007-T*0.05));',
    '  if(band>0.0){c=mix(c,vec3(1.0),band);a=max(a,0.04*band);}',
    '  float hot=step(0.9994,fract(sin(dot(floor(x/2.0)+floor(T*9.0),vec2(12.9898,78.233)))*43758.5453));',
    '  if(hot>0.5){c=vec3(1.0);a=1.0;}',
    '  gl_FragColor=vec4(c,a);',
    '}'
  ].join('\n');

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  var vsh = compile(gl.VERTEX_SHADER, vs);
  var fsh = compile(gl.FRAGMENT_SHADER, fs);
  if (!vsh || !fsh) return;

  var program = gl.createProgram();
  gl.attachShader(program, vsh);
  gl.attachShader(program, fsh);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var attr = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

  var timeLocation = gl.getUniformLocation(program, 'T');
  var started = performance.now();
  var running = true;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.max(1, Math.floor(window.innerWidth * dpr));
    var height = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function draw(now) {
    if (!running) return;
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(timeLocation, reduced ? 0 : (now - started) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced) requestAnimationFrame(draw);
  }

  /* Inline styles override the earlier stylesheet rule that used an
     opaque overlay; keep this layer fully transparent except its pixels. */
  canvas.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100%',
    'height:100%',
    'z-index:-1',
    'pointer-events:none',
    'display:block',
    'mix-blend-mode:normal',
    'opacity:' + (reduced ? '0.4' : '1')
  ].join(';');

  document.body.appendChild(canvas);
  resize();
  draw(performance.now());

  window.addEventListener('resize', function () {
    if (reduced) draw(performance.now());
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
    } else if (!reduced) {
      running = true;
      requestAnimationFrame(draw);
    }
  });

  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    running = false;
    canvas.remove();
  });
})();
